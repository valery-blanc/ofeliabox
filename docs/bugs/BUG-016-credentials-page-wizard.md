# BUG-016 — Page identifiants : credentials incorrects ou anciens

**Status:** BY DESIGN / EXPLAINED  
**Date:** 2026-05-01

## Symptom

La page `/credentials.html` affiche des identifiants qui ne semblent pas correspondre
à la nouvelle installation.

## Explanation

Les identifiants affichés sont ceux générés par le setup wizard lors de l'installation.
Ils sont stockés dans `portal/credentials-data.json` (exclu du git par `.gitignore`).

Les valeurs codées en dur dans le HTML (Moodle : `vfeJt38uKwSKZKgnEduBox!`, Kolibri :
`EduBox-2026!`, etc.) sont les identifiants de l'**ancienne box** sur l'ancienne SD card.
Sur la nouvelle box, ces valeurs sont remplacées dynamiquement via JS depuis
`credentials-data.json`.

Si `credentials-data.json` n'existe pas (wizard non lancé ou erreur), la page affiche
les valeurs codées en dur de l'ancienne SD.

## Resolution

Après une installation via le wizard, vérifier que `/opt/edubox/portal/credentials-data.json`
existe sur le Pi. Si absent, relancer le wizard.
