# FEAT-002 — Nginx : routage multi-applications

**Statut** : DONE
**Date** : 2026-03-28

## Contexte

Chaque application (Moodle, Kolibri, Koha) génère des URLs absolues qui ne tiennent pas compte du préfixe de chemin nginx. Résoudre ces incompatibilités sans modifier les images Docker upstream.

## Solutions implémentées

### Moodle — sub_filter + Host localhost
- `wwwroot = http://localhost` dans config.php (correspond au host vu par Moodle après stripping du préfixe)
- nginx force `Host: localhost` vers le container Moodle
- `proxy_set_header Accept-Encoding ""` pour désactiver gzip (sub_filter ne fonctionne pas sur contenu compressé)
- `sub_filter 'http:\/\/localhost' 'http:\/\/192.168.50.1\/moodle'` — corrige JSON encodé
- `sub_filter 'http://localhost' 'http://192.168.50.1/moodle'` — corrige HTML/JS
- `proxy_redirect http://localhost/ http://192.168.50.1/moodle/` — corrige redirects HTTP

### Kolibri — KOLIBRI_URL_PATH_PREFIX
- Variable d'env `KOLIBRI_URL_PATH_PREFIX=/kolibri` → Kolibri génère toutes ses URLs avec le préfixe
- nginx : `proxy_pass http://kolibri/kolibri/` (conserve le préfixe /kolibri/ dans les requêtes upstream)

### Koha — routes supplémentaires
- `/biblio/` → koha_opac (port 8080)
- `/biblio-admin/` → koha_staff (port 8081) — restreint au réseau local
- `/cgi-bin/koha/` → koha_staff — pour redirects internes de l'installeur
- `/intranet-tmpl/` → koha_staff — assets CSS/JS staff (chemins absolus sans préfixe)
- `/opac-tmpl/` → koha_opac — assets CSS/JS OPAC

### Portail captif Android
- `location = /generate_204` et `/gen_204` → `return 204` (Android détecte "internet OK", pas de popup)
- `address=/#/192.168.50.1` dans dnsmasq → tout DNS résolu vers le Pi

## Impact
- Moodle : JS AJAX fonctionne (M.cfg.wwwroot correct après sub_filter)
- Kolibri : navigation complète fonctionnelle
- Koha : installeur web + interface staff accessibles
- Android : connexion silencieuse au WiFi sans popup "pas d'internet"
