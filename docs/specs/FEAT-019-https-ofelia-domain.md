# FEAT-019 — URL de base https://ofelia/ et https://ofelia:8080

**Status:** DONE  
**Date:** 2026-05-02

## Context

L'utilisateur souhaite accéder au portail via `https://ofelia/` (HTTPS).
Cela nécessite un certificat SSL et une configuration nginx HTTPS.

## Behavior

- `https://ofelia/` → portail principal (HTTPS)
- `http://ofelia/` → portail principal (HTTP, conservé pour captive portal)
- HTTP n'est PAS redirigé vers HTTPS : les appareils Android/iOS utilisent HTTP
  pour la détection du portail captif ; une redirection casserait ce mécanisme.
- Le navigateur affiche une alerte "certificat non fiable" (Option A, auto-signé).
  L'utilisateur doit accepter une fois. Option B (Root CA local) peut être
  implémentée ultérieurement pour supprimer l'alerte.

## Technical spec — Option A (implémentée)

- Certificat auto-signé RSA 2048 bits, 10 ans, SAN : `ofelia`, `ofelia.local`,
  `192.168.50.1`, `127.0.0.1`
- Généré par `bootstrap.sh` à l'installation (openssl, idempotent)
- Stocké dans `/opt/edubox/ssl/` (monté en `:ro` dans le container nginx)
- Nginx écoute sur port 443 (SSL) en plus du port 80
- Les locations nginx sont partagées entre HTTP et HTTPS via `include` pour
  éviter la duplication de config
- Le sub_filter Moodle utilise `$scheme://` (variable nginx) pour fonctionner
  correctement sur les deux protocoles

## Files modified

- `bootstrap.sh` : étapes renumérotées 1–6, ajout étape 5 SSL (openssl)
- `docker-compose.yml` : nginx-proxy — ajout port `443:443` et volume
  `/opt/edubox/ssl:/etc/nginx/ssl:ro`
- `nginx/conf.d/edubox.conf` : map `$back_btn`, serveur HTTPS port 443,
  include `ofelia-locations.conf`
- `nginx/conf.d/ofelia-locations.inc` : nouveau — toutes les locations
  partagées (portail, Moodle, Kolibri, Koha, PMB, SLiMS, Kiwix).
  Extension `.inc` (pas `.conf`) pour éviter que nginx l'auto-charge
  dans le contexte `http` (où `location` n'est pas permis).

## Impact on existing code

- Le sub_filter Moodle est mis à jour : `http://$http_host` → `$scheme://$http_host`
  (meilleur comportement HTTPS, sans regression HTTP)
- `$back_btn` déplacé de `set` (server-context) vers `map` (http-context) pour
  être disponible dans tous les server blocks (dont Digistorm port 3000)

## Next steps (Option B — Root CA local)

Pour supprimer l'alerte navigateur sans action utilisateur :
1. Générer un Root CA à l'installation
2. Signer le certificat serveur avec ce CA
3. Distribuer le Root CA via `/assets/ofelia-ca.crt`
4. Documenter l'import du CA sur Android/iOS/Windows
