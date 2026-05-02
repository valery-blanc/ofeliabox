# BUG-021 — Moodle redirige vers localhost au lieu de l'IP réelle

**Status:** FIXED
**Date:** 2026-05-02

## Symptom

En accédant à Moodle via `http://192.168.0.147/moodle/`, certaines pages
(notamment après login ou lors de redirections internes) redirigent vers
`http://localhost/moodle/...` au lieu de `http://192.168.0.147/moodle/`.

## Root cause

Moodle génère des redirections HTTP (`Location:` header) avec son `wwwroot`.
Le script `99-fix-wwwroot.sh` patche `config.php` pour utiliser `HTTP_HOST`
dynamiquement, mais ne couvre pas les redirections émises avant que PHP soit
initialisé, ni les redirections Apache (en-dehors de PHP).

Nginx n'avait pas de `proxy_redirect` pour transformer ces réponses.

## Fix applied

1. `proxy_redirect http://localhost/moodle/ http://$http_host/moodle/;` — intercepte les `Location:` headers
2. `sub_filter` double dans nginx pour réécrire les URLs localhost dans le corps de la réponse :
   - `sub_filter 'http://localhost/moodle' 'http://$http_host/moodle';` — pour les href/src
   - `sub_filter 'http:\/\/localhost\/moodle' 'http:\/\/$http_host\/moodle';` — pour le JSON-encodé dans M.cfg/YUI_config
   - `sub_filter_once off` pour remplacer TOUTES les occurrences
3. `chmod +x moodle/99-fix-wwwroot.sh` sur le Pi — pour les futures recréations de container
4. `php admin/cli/purge_caches.php` — purge du cache Moodle

**Pièges** :
- `proxy_redirect http://localhost/` (sans `/moodle/`) cause un double `/moodle/moodle/`
- Le script `99-fix-wwwroot.sh` n'est pas exécuté s'il n'a pas le bit exécutable sur le Pi
- Moodle encode les URLs en JSON avec `\/` → il faut deux sub_filter patterns

## Spec section impacted

Section 4.1 (Moodle) de specs_keebee.md — note sur proxy_redirect nginx
