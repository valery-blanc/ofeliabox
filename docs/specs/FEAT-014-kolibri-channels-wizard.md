# FEAT-014 — Kolibri : canaux Khan Academy dans le wizard

**Status:** IN PROGRESS  
**Date:** 2026-05-01

## Context

Kolibri est installé sans contenu sur une nouvelle box. L'utilisateur doit importer
manuellement les canaux. La demande est d'ajouter les canaux Khan Academy ES et FR
directement dans le wizard d'installation, comme les ZIMs Kiwix.

## Behavior

Dans la section "Bibliothèques hors-ligne" du wizard, ajouter un groupe "Kolibri" avec :
- 🇪🇸 Khan Academy Español (~37 Go) — recommandé
- 🇫🇷 Khan Academy Français (~10 Go)

Au démarrage, si ces canaux sont sélectionnés, le wizard déclenche une importation
Kolibri via la CLI (`kolibri manage importchannel` + `kolibri manage importcontent`).

## Technical spec

Les canaux Kolibri sont identifiés par leur channel ID :
- Khan Academy ES : `6e6456d265e14543a…` (à confirmer via `kolibri manage listchannels`)
- Khan Academy FR : channel ID FR

Import via CLI dans le container :
```bash
docker exec edubox-kolibri kolibri manage importchannel network <channel_id>
docker exec edubox-kolibri kolibri manage importcontent network <channel_id>
```

Le téléchargement peut durer des heures — streamer la progression via SSE.

## Files to modify

- `setup/templates/index.html` : ajouter groupe "Kolibri" dans la section ZIMs
- `setup/app.py` : ajouter les IDs de canaux dans `ZIMS` ou un nouveau catalogue `KOLIBRI_CHANNELS`
- `setup/app.py` : fonction `_import_kolibri_channel(channel_id)` avec streaming SSE

## Impact

Kolibri doit être démarré avant l'import → le wizard devra attendre que Kolibri soit
healthy avant de lancer les imports.
