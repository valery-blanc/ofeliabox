# FEAT-023 — Identifiants Calibre + bouton modifier

**Status:** DONE
**Date:** 2026-05-05

## Context
La page `/credentials.html` ne liste pas Calibre-Web. De plus, si un admin modifie un mot de passe directement dans une application (Moodle, Koha, etc.), la page identifiants reste désynchronisée car credentials-data.json n'est mis à jour que par le wizard.

## Behavior
1. Ajouter un bloc **Calibre-Web** sur la page identifiants avec user=admin / password=Admin2026!
2. Ajouter un bouton **✏ Modifier** dans le header : bascule en mode édition
   - Tous les champs password (et user quand pertinent) deviennent des inputs éditables
   - Boutons "Sauvegarder" et "Annuler" remplacent "Modifier"
   - Sauvegarder : POST `/setup-api/api/update-credentials` → met à jour credentials-data.json côté serveur
   - Annuler : restaure les valeurs initiales sans appel réseau

## Technical spec
- `portal/credentials.html` : bloc Calibre + JS mode édition + appel API
- `setup/app.py` : route `POST /api/update-credentials` — lit JSON body, fusionne avec credentials-data.json existant (préserve les champs absents de la page comme mariadb), écrit le fichier
- `nginx/conf.d/ofelia-locations.inc` : `location /setup-api/` proxy vers `http://edubox-setup:8080/`
- `setup/app.py` `_write_credentials()` : ajouter `calibre` avec user=admin / password depuis config

## Impact on existing code
- `portal/credentials.html` — ajout bloc + JS
- `setup/app.py` — ajout route + mise à jour _write_credentials
- `nginx/conf.d/ofelia-locations.inc` — ajout location /setup-api/
