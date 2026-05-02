# BUG-017 — Wizard : état des cases à cocher non persisté après installation

**Status:** IN PROGRESS  
**Date:** 2026-05-01

## Symptom

Quand on retourne sur le wizard après une installation, les cases à cocher affichent
les valeurs par défaut (Moodle/Kolibri/Koha cochés, Wikipedia cochée) au lieu de
l'état réellement installé (PMB, SLiMS, Digistorm, Gutenberg-ES restent vides).

## Root cause

Le wizard ne persiste pas l'état de l'installation. Chaque chargement de page repart
des valeurs initiales codées en dur dans le HTML.

## Fix to apply

Après une installation réussie, écrire l'état dans un fichier JSON sur le Pi
(`/opt/edubox/portal/wizard-state.json`). Au chargement du wizard, lire ce fichier
et cocher les bonnes cases.

## Files to modify

- `setup/app.py` : écrire `wizard-state.json` à la fin de `_install_stream()`
- `setup/templates/index.html` : lire `wizard-state.json` via `fetch('/api/state')`
  au chargement et cocher les cases correspondantes
- `setup/app.py` : ajouter route `GET /api/state`
