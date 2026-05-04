# BUG-026 — ZeroTier absent du wizard d'installation

**Status:** DONE (installation manuelle) / TODO (intégration wizard)
**Date:** 2026-05-04

## Symptom

ZeroTier n'est pas installé sur le Pi alors que TASKS.md le marquait `[x]`.
Le service `zerotier-one` n'existe pas, `zerotier-cli` est absent.
Conséquence : le Pi n'est pas joignable via `10.115.169.147` (réseau ZeroTier).

## Root cause

L'installation de ZeroTier était planifiée en Phase 6 (tâche manuelle) mais n'a jamais
été faite sur le Pi courant. La tâche avait été cochée prématurément.

De plus, le wizard d'installation (EduBox Setup) n'incluait pas de step ZeroTier —
alors que la spec (§9.2) prévoit ZeroTier comme composant de base du monitoring
et de l'accès distant.

## Fix applied

### Étape 1 — Installation manuelle immédiate

```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join f3797ba7a8e6a4b5
sudo systemctl enable zerotier-one
```

Réseau : `f3797ba7a8e6a4b5`
IP attendue : `10.115.169.147` (à réassigner depuis ZeroTier Central si nécessaire)

### Étape 2 — Intégration au wizard (à faire)

Ajouter une étape "ZeroTier" dans le flux d'installation SSE de `setup/app.py` :
- Installer ZeroTier via le script officiel
- Rejoindre le réseau `f3797ba7a8e6a4b5` (ID stocké dans la config ou passé en paramètre)
- `systemctl enable zerotier-one`
- Afficher l'adresse ZeroTier et l'IP assignée

## Spec section impacted

`docs/specs/specs_keebee.md` §9.2 — Accès distant ZeroTier
