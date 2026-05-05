# FEAT-025 — Calibre-Web : tuile dans la grille Applications (import manuel)

**Statut** : DONE 2026-05-05
**Composant** : `setup/templates/index.html`, `setup/app.py`

## Contexte

Calibre-Web était installé via une section dédiée "Bibliothèque numérique" avec un sélecteur de shards HuggingFace. Cette section était déconnectée de la grille principale des applications et impliquait le téléchargement automatique de livres depuis HuggingFace (PleIAs/Spanish-PD-Books), ce qui était lourd et optionnel.

Le workflow retenu est : les EPUBs sont copiés manuellement dans `/opt/edubox/data/books/` (après enrichissement via `calibre_enrich.py` sur machine de développement, ou importés directement depuis une bibliothèque HuggingFace existante).

## Comportement

### Tuile "Calibre-Web" dans la grille Applications

- Icône : 📕
- Nom : **Calibre-Web**
- Description : *Outil de gestion de epub du domaine public (par exemple bibliothèques HuggingFace) à copier dans /opt/edubox/data/books/*
- Badge : Optionnel
- Non cochée par défaut

### Installation (quand la tuile est sélectionnée)

1. Création des répertoires `/opt/edubox/data/books/` et `/opt/edubox/data/calibre/`
2. Démarrage du container `calibre` via `docker compose up`
3. Configuration automatique du chemin bibliothèque (`/books`) via `_configure_calibre_web()`

Aucun téléchargement de livres — l'import se fait manuellement par copie dans `/opt/edubox/data/books/`.

## Suppressions

- Section HTML "Bibliothèque numérique (Calibre-Web)" entièrement supprimée
- Sélecteur de shards, checkbox "Tout importer", hint parquet — supprimés
- Variables JS `calibreEnabled`, fonctions `toggleCalibre()`, `updateCalibeSummary()` — supprimées
- Clé `calibre` séparée dans le payload d'install et dans `wizard-state.json` — supprimée
- Constante Python `CALIBRE_SHARDS_DEFAULT` et paramètre de template `calibre_shards_default` — supprimés
- Fonction `_install_calibre(n_shards)` remplacée par un bloc inline simplifié

## Règle importante (BUG-027)

Toute `metadata.db` copiée dans `/opt/edubox/data/books/` doit contenir la table `library_id`. Voir BUG-027 pour le fix si elle est absente.
