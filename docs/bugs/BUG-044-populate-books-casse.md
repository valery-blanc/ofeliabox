# BUG-044 — `populate_books.py` produit zéro livre et annonce « terminé »

**Statut :** OUVERT — contourné par restauration, pas corrigé
**Constaté :** 2026-08-26, en tentant de régénérer la bibliothèque Calibre après
le remplacement de la carte SD.

---

## Le symptôme

Le script se déroule sans erreur fatale, écrit dans son journal :

```
=== Calibre : 2835 livres (3 shards) ===
129 shards disponibles — traitement de 3 (début: shard 1)
Shard 1/129 : spanish_pd_1.parquet
Calibre terminé — 117M
=== TOUT EST TERMINE ===
```

…et la base ne contient **aucun livre** :

```sql
SELECT COUNT(*) FROM books;  -- 0
```

Il crée pourtant ~2 000 dossiers d'auteurs, ce qui donne l'illusion d'un travail
abouti. **C'est la combinaison qui est dangereuse** : un journal qui dit
« terminé », une arborescence qui paraît remplie, et zéro donnée exploitable.

## La cause

Noyée dans la sortie, une ligne par livre :

```
⚠️  Livre 1 ignoré : table books has no column named uuid
⚠️  Livre 2 ignoré : table books has no column named uuid
```

Le script crée son propre schéma Calibre avec `init_calibre_db()`, et ce schéma
ne correspond plus à ce que la version actuelle de Calibre-Web attend — la
colonne `uuid` de la table `books` y manque. Chaque insertion échoue, est
attrapée, journalisée en avertissement, et le script continue.

## Pourquoi ce n'est pas corrigé

La bibliothèque a été **récupérée sur l'ancienne carte** plutôt que régénérée —
et c'était le meilleur choix : elle contenait **150 555 livres**, pas les 2 835
que la régénération visait. Le dataset complet (`PleIAs/Spanish-PD-Books`,
129 shards, 48,6 Go) avait manifestement été importé bien au-delà des 3 shards
d'origine.

Corriger le script aurait donné une bibliothèque **cinquante fois plus petite**
que celle qu'on a récupérée.

## Quand cela deviendra bloquant

Le jour où la bibliothèque devrait être reconstruite depuis zéro — perte de la
sauvegarde, ou installation d'une seconde Box. Il faudra alors :

1. aligner `init_calibre_db()` sur le schéma attendu (au minimum `books.uuid`) ;
2. **faire échouer le script bruyamment** quand aucun livre n'a été inséré : un
   `Calibre terminé` sur 0 livre est un mensonge, pas un avertissement.

## Vérification à faire après toute exécution

Ne pas se fier au journal :

```bash
sqlite3 /opt/edubox/data/books/metadata.db "SELECT COUNT(*) FROM books;"
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `setup/scripts/populate_books.py` | le script fautif |
| `scripts/telecharger-contenus.sh` | l'appelle, et hérite du faux « terminé » |
