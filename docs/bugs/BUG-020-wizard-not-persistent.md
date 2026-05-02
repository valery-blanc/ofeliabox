# BUG-020 — Wizard d'installation inaccessible après redémarrage

**Status:** FIXED
**Date:** 2026-05-02

## Symptom

`http://192.168.0.147:8080/` ne répond plus après un redémarrage du Pi ou
une session SSH fermée.

## Root cause

Le wizard (setup/app.py) était lancé via `nohup python3 ... &` dans bootstrap.sh.
Ce processus ne survit pas à un redémarrage du Pi, et meurt si la session SSH parente
est fermée de manière anormale.

Aucun service systemd ni Docker ne le relançait automatiquement.

## Fix applied

Ajout d'un service `setup` dans `docker-compose.yml` :
- Build depuis `setup/Dockerfile` (Python + Docker CLI + Flask)
- Monte `/opt/edubox` et `/var/run/docker.sock`
- Restart `unless-stopped` → survit aux redémarrages
- Port 8080 exposé

`bootstrap.sh` modifié : utilise `docker compose up -d --build setup`
au lieu de `nohup python3 ...`.

## Spec section impacted

Section 8 (Setup Wizard) de specs_keebee.md
