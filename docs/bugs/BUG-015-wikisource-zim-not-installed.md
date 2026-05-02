# BUG-015 — Wikisource : erreur ZIM "chemin non trouvé"

**Status:** NOT A BUG — ZIM non installé  
**Date:** 2026-05-01

## Symptom

`http://192.168.0.147/wiki/viewer#wikisource_es/Portada` → erreur Kiwix :
"Le chemin demandé n'a pas été trouvé"

## Explanation

Le ZIM `wikisource_es.zim` n'a pas été coché lors de l'installation via le wizard.
Kiwix ne peut pas servir un ZIM qui n'est pas chargé.

La commande kiwix dans `docker-compose.yml` ne contient que les ZIMs effectivement
sélectionnés lors de l'installation.

## Resolution

Sélectionner "Wikisource Español (728 Mo)" dans le wizard et relancer l'installation,
ou ajouter manuellement le ZIM :
1. Télécharger le ZIM dans `/opt/edubox/kiwix/data/`
2. Ajouter `wikisource_es.zim` à la commande kiwix dans `docker-compose.yml`
3. `docker compose restart kiwix`
