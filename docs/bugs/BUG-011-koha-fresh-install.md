# BUG-011 — Koha : page not found + koha-create avorte sur fresh install

**Status:** FIXED  
**Date:** 2026-05-01

## Symptom

- `http://192.168.0.147/cgi-bin/koha/opac-changelanguage.pl?language=en` → 404
- `koha-plack` s'arrête immédiatement après démarrage
- `edubox.conf` Apache reste vide (0 octets)

## Root cause

Deux bugs combinés :

**Bug 1 — Bind mount `/etc/koha` entier**  
`/opt/edubox/data/koha/config:/etc/koha` masquait tous les fichiers du package `koha-common`
installés dans `/etc/koha/`, dont les templates Apache (`apache-site.conf.in`) et Koha
(`koha-conf-site.xml.in`). Sans ces templates, `koha-create` ne pouvait pas générer les
fichiers de configuration.

**Bug 2 — `/var/log/koha/$INSTANCE` pré-créé avant koha-create**  
L'entrypoint pré-créait `/var/log/koha/edubox` avec `mkdir -p`. Ensuite `koha-create`
(qui a `set -e`) appelle `mkdir /var/log/koha/edubox` (sans `-p`). Cette commande échoue
car le répertoire existe déjà, ce qui déclenche `set -e` et fait avorter `koha-create`
avant de générer `koha-conf.xml` et l'Apache config.

## Fix applied

1. `docker-compose.yml` : changé le bind mount de `/etc/koha` → `/etc/koha/sites` uniquement,
   préservant les fichiers du package `koha-common` dans `/etc/koha/`.

2. `koha/entrypoint.sh` : déplacé la création de `/var/log/koha/$INSTANCE` APRÈS l'appel
   à `koha-create` (avec un commentaire expliquant pourquoi).

## Spec section impacted

`docs/specs/specs_keebee.md` — section Koha / Architecture Docker
