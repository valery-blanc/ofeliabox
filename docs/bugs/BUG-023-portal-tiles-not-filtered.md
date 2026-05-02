# BUG-023 — Tuiles du portail non filtrées selon les apps installées

**Status:** FIXED
**Date:** 2026-05-02

## Symptom

Le portail principal (`/`) affiche toutes les tuiles (Wikisource, PMB, SLiMS,
Digistorm, Gutenberg...) même quand ces applications n'ont pas été installées
via le wizard.

Si l'utilisateur n'a pas installé Wikisource, sa tuile apparaît quand même
et mène à une page d'erreur.

## Root cause

`portal/index.html` affichait toutes les tuiles en dur, sans vérifier
l'état de l'installation dans `wizard-state.json`.

## Fix applied

Au chargement du portail, `fetch('/wizard-state.json')` est appelé.
Si le fichier existe et contient `apps` / `zims`, les tuiles non installées
sont masquées via `display: none`.

Mapping wizard → cartes :
- apps: moodle, kolibri, koha, pmb, slims, digistorm → card-{id}
- zims wikipedia_es/fr → card-wikipedia
- zims wikisource_es/fr → card-wikisource
- zims gutenberg_* → card-gutenberg

Si `wizard-state.json` est absent (installation manuelle hors wizard),
toutes les tuiles restent visibles (comportement actuel préservé).

## Spec section impacted

Section 3 (Portail) de specs_keebee.md — tuiles dynamiques
