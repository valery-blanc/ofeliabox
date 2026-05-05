# BUG-027 — Calibre-Web : erreur 500 après redémarrage Pi (table library_id absente)

**Statut** : FIXED 2026-05-05
**Composant** : `edubox-calibre` (linuxserver/calibre-web)

## Symptôme

Après un débranch/rebranch de l'alimentation du Pi, Calibre-Web répond 500 sur toutes les pages. Le container redémarre en boucle.

## Logs

```
sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) no such table: library_id
[SQL: SELECT library_id.id AS library_id_id, library_id.uuid AS library_id_uuid FROM library_id]
```

L'exception se produit dans `config_sql.py:store_calibre_uuid()` lors de l'init de l'application.

## Cause racine

La `metadata.db` importée manuellement (provenant d'un export Calibre antérieur ou du pipeline `populate_books.py`) ne contenait pas la table `library_id`, introduite dans les versions récentes de Calibre. Calibre-Web (linuxserver) attend cette table à chaque démarrage pour stocker/lire l'UUID de la bibliothèque.

Un rebranch force le container à redémarrer depuis zéro, exposant le crash qui était masqué tant que le container restait up.

## Fix appliqué

Création manuelle de la table `library_id` avec un UUID v4 dans la `metadata.db` :

```bash
docker compose exec calibre sqlite3 /books/metadata.db \
  "CREATE TABLE IF NOT EXISTS library_id(
     id INTEGER PRIMARY KEY,
     uuid TEXT NOT NULL DEFAULT ''
   );
   INSERT INTO library_id(uuid)
     VALUES(lower(hex(randomblob(4))) || '-' ||
            lower(hex(randomblob(2))) || '-4' ||
            substr(lower(hex(randomblob(2))),2) || '-' ||
            substr('89ab',abs(random()) % 4 + 1, 1) ||
            substr(lower(hex(randomblob(2))),2) || '-' ||
            lower(hex(randomblob(6))));"
docker compose restart calibre
```

## Règle à retenir

Toute `metadata.db` importée dans `/opt/edubox/data/books/` doit contenir la table `library_id`. Si elle est absente (base générée par un outil tiers ou une version ancienne de Calibre), exécuter le fix ci-dessus avant de démarrer le container.
