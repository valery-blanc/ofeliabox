# BUG-002 — Kiwix : port 8080 pas 80

**Statut** : FIXED
**Date** : 2026-03-28
**Composant** : `docker-compose.yml`, `nginx/conf.d/edubox.conf`

## Symptôme

Après déploiement du container Kiwix, nginx retourne `502 Bad Gateway` sur `/wiki/` et le healthcheck marque Kiwix `unhealthy`.

## Cause racine

L'image `ghcr.io/kiwix/kiwix-serve` expose kiwix-serve sur le port **8080** via son ENTRYPOINT (`--port=8080`), pas sur le port 80 (défaut documenté). La config nginx avait `server edubox-kiwix:80` et le healthcheck testait `http://localhost:80/`.

## Fix appliqué

- `nginx/conf.d/edubox.conf` : `upstream kiwix { server edubox-kiwix:8080; }`
- `docker-compose.yml` healthcheck : `http://localhost:8080/`

## Règle à retenir

L'image `ghcr.io/kiwix/kiwix-serve:latest` écoute sur **8080**, pas 80. Ne pas redéclarer `--port=8080` dans `command` du docker-compose — l'ENTRYPOINT de l'image l'ajoute déjà, ce qui duplique le flag et fait crasher kiwix-serve avec `Unexpected argument`.
