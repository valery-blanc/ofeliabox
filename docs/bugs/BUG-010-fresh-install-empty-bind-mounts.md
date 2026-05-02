# BUG-010 — Fresh install : bind mounts vides crashent Moodle, PMB, SLiMS

**Status:** FIXED  
**Date:** 2026-05-01

## Symptom

Sur une nouvelle installation via le wizard, plusieurs services crashent :
- Moodle : `Could not open input file: /var/www/html/admin/cli/install.php` → restart loop
- PMB : 500 Internal Server Error
- SLiMS : installeur signale `/config is writable: NO` et `/files is writable: NO`

## Root cause

Les bind mounts montaient des répertoires vides du host par-dessus des répertoires contenant
des fichiers applicatifs dans l'image Docker. Le répertoire vide du host masque tout le
contenu de l'image.

- Moodle : `- /opt/edubox/data/moodle/html:/var/www/html` → cachait les PHP files de Moodle
- PMB : `- /opt/edubox/data/pmb/config:/var/www/html/pmb/includes` → cachait les PHP classes
- SLiMS : `- /opt/edubox/data/slims/config:/var/www/html/slims/config` → même problème

Sur l'ancienne SD, ces répertoires étaient déjà peuplés → tout fonctionnait.

## Fix applied

- Moodle : supprimé le bind mount `html:` — les PHP files restent dans l'image (ils ne changent pas)
- PMB : remplacé le bind mount `includes:` par un **volume nommé** `pmb_includes:` — Docker initialise les volumes nommés depuis le contenu de l'image au premier démarrage
- SLiMS : idem → `slims_config:` volume nommé

## Spec section impacted

`docs/specs/specs_keebee.md` — section Architecture Docker / Volumes
