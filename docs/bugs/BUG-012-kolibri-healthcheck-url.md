# BUG-012 — Kolibri faux unhealthy — mauvaise URL healthcheck

**Status:** FIXED  
**Date:** 2026-05-01

## Symptom

`docker compose ps` affichait `edubox-kolibri (unhealthy)` bien que Kolibri fonctionnait
correctement via le portail.

## Root cause

Le healthcheck Docker vérifiait `http://localhost:8080/api/public/info/` mais Kolibri
tourne avec `KOLIBRI_URL_PATH_PREFIX=/kolibri` — toutes ses URLs commencent par `/kolibri/`.
L'URL correcte est `http://localhost:8080/kolibri/api/public/info/`.

## Fix applied

`docker-compose.yml` : corrigé l'URL du healthcheck Kolibri.

## Spec section impacted

`docs/specs/specs_keebee.md` — section Kolibri
