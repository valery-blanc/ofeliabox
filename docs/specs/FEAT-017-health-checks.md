# FEAT-017 — Tests unitaires : vérification URLs après installation

**Status:** DONE
**Date:** 2026-05-02

## Context

Après l'installation d'une application, il faut vérifier que le service
répond correctement (pas de page d'erreur, pas de redirect localhost,
pas d'URL vide). Ces vérifications aident à détecter rapidement les
problèmes de configuration.

## Behavior

À la fin du flux d'installation (après `docker compose up`), le wizard
vérifie automatiquement chaque service installé :
- Inspecte l'état de santé Docker via `docker inspect Health.Status`
- Rapporte healthy / starting / unhealthy pour chaque service
- Si unhealthy : log un avertissement et pointe vers les logs

## Technical spec

Fonction `_report_health(services)` dans app.py :
- Pour chaque service dans services : `docker inspect --format {{.State.Health.Status}} edubox-{svc}`
- Services sans healthcheck → état non vérifié (log "no healthcheck")
- Résultats affichés dans la console SSE avant le message "Installation terminée"

## Impact on existing code

- `setup/app.py` : ajout de `_report_health()` appelé depuis `_install_stream()`
