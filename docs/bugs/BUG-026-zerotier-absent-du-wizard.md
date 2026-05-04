# BUG-026 — ZeroTier absent du wizard d'installation

**Status:** DONE
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

### Installation

Intégré dans `bootstrap.sh` (étape 5/7). Actions :
1. `curl -s https://install.zerotier.com | bash`
2. Écriture de `/var/lib/zerotier-one/local.conf` avec `tcpFallbackRelay: true`
3. Écriture de `/etc/NetworkManager/dispatcher.d/99-zerotier-restart` (restart ZeroTier sur coupure eth0)
4. `zerotier-cli join f3797ba7a8e6a4b5`
5. Affichage de l'adresse ZeroTier pour autorisation dans Central

### Comportement sans câble Ethernet (CGNAT / hotspot téléphone)

ZeroTier fonctionne derrière double NAT grâce à deux mécanismes :
- **`tcpFallbackRelay: true`** : force le relay TCP via serveurs PLANET quand UDP hole-punching échoue
- **NM dispatcher** : redémarre ZeroTier à la coupure eth0 pour forcer la réinitialisation des chemins via wlan1

Délai normal de basculement : **~3 minutes** après retrait du câble.

### Wizard

`setup/app.py` : `_check_zerotier_status()` lit `/var/lib/zerotier-one/identity.public`
(volume monté en ro dans docker-compose.yml) et affiche adresse + IP à la fin de l'installation.

### Autorisation

Réseau `f3797ba7a8e6a4b5`, Pi IP `10.115.169.147`, adresse `1b6d1d7c29`.
Autorisation manuelle dans ZeroTier Central requise à chaque nouvelle installation.

## Spec section impacted

`docs/specs/specs_keebee.md` §9.2 — Accès distant ZeroTier
