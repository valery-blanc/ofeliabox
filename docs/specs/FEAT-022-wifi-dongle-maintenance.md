# FEAT-022 — Double WiFi : dongle USB WiFi6 + wizard connexion internet

**Status:** DONE
**Date:** 2026-05-04

## Context

L'utilisateur a branché un adaptateur WiFi6 USB sur le Raspberry Pi. L'objectif
est d'avoir deux interfaces WiFi distinctes :
- `wlan0` (WiFi intégré Pi 5) → AP "Ofelia" pour les tablettes (inchangé)
- `wlan1` (dongle USB WiFi6) → connexion client internet/maintenance (sans câble)

## Behavior

### Wizard — nouvelle section "Connexion internet WiFi"

- Détection automatique du dongle : cherche la première interface `wlanX` ≠ `wlan0`
- Si détecté : affiche le nom de l'interface + bouton "Rechercher les réseaux"
- Si non détecté : message "Dongle WiFi non détecté — branchez l'adaptateur USB"
- Après scan : liste des réseaux (SSID + signal + cadenas si WPA)
  - Tri par force de signal décroissant
  - Clic sur un réseau → remplit le champ SSID
- Champ mot de passe (masqué) + bouton "Connecter"
- Statut en temps réel : En cours / Connecté (IP) / Erreur

### Décision AP

- L'AP reste sur `wlan0` (intégré Pi). Éprouvé, déjà configuré, stable.
- Le dongle USB WiFi6 (wlan1) est utilisé pour la connexion client internet.
- Raisonnement : le gain de performances du dongle pour l'AP ne justifie pas
  la complexité de migrer la configuration AP existante.

## Technical spec

### Container setup — accès à NetworkManager hôte

Le wizard tourne dans un container Docker. nmcli doit parler au NM hôte via D-Bus.

**setup/Dockerfile** : ajouter `network-manager` (fournit le binaire `nmcli`)

**docker-compose.yml** service `setup` :
- Volume : `- /run/dbus:/run/dbus` (socket D-Bus système hôte)
- Capability : `NET_ADMIN` (gestion de connexions réseau)

### Nouvelles routes Flask (setup/app.py)

- `GET /api/wifi/interfaces` → détecte wlan1 (ou première iface non-AP)
  - Retourne `{"iface": "wlan1", "found": true}` ou `{"found": false}`

- `GET /api/wifi/scan` → `nmcli --terse -f SSID,SIGNAL,SECURITY dev wifi list ifname <iface>`
  - Retourne liste de réseaux triés par signal décroissant

- `POST /api/wifi/connect` body `{"ssid": "...", "password": "..."}` →
  `nmcli dev wifi connect <ssid> password <password> ifname <iface>`

- `GET /api/wifi/status` → `nmcli -t -f DEVICE,STATE,CONNECTION,IP4.ADDRESS dev show <iface>`
  - Retourne `{"state": "connected", "ssid": "...", "ip": "..."}`

### Helper interne

`_wifi_client_iface()` : lit `nmcli -t -f DEVICE,TYPE dev` et retourne la première
interface `wifi` dont le nom ≠ `wlan0` (ou plus précisément, qui n'est pas l'AP).

## Impact on existing code

- `setup/Dockerfile` : +1 package `network-manager`
- `docker-compose.yml` : +volume `/run/dbus` + `cap_add: NET_ADMIN` sur service `setup`
- `setup/app.py` : +4 routes + 1 helper
- `setup/templates/index.html` : +1 section HTML + JS

## Notes — Installation driver RTL8852BU

Le dongle ASUS USB-AX55 Nano (`0b05:1a62`) utilise le chipset **RTL8852BU**.
Ce chipset n'est PAS supporté nativement dans le kernel Pi OS 6.12 (rtw89 = PCIe only).

**Driver DKMS requis :** `morrownr/rtl8852bu-20250826`

Installation :
```bash
sudo apt-get install -y dkms build-essential bc
curl -sL https://codeload.github.com/morrownr/rtl8852bu-20250826/tar.gz/refs/heads/main -o /tmp/rtl8852bu.tar.gz
cd /tmp && tar xzf rtl8852bu.tar.gz
cd rtl8852bu-20250826-main && sudo ./install-driver.sh NoPrompt
```

**Fix obligatoire** : ajouter `rtw_low_power=0` dans `/etc/modprobe.d/8852bu.conf` :
```
options 8852bu rtw_switch_usb_mode=0 rtw_low_power=0
```
Sans ce flag, le driver crashe en boucle (`Runtime PM usage count underflow`) au branchement.

Après install : `sudo update-initramfs -u` pour persister au reboot.
- La connexion est persistée par NetworkManager (autoconnect=yes par défaut).
- La section WiFi du wizard est indépendante du bouton "Installer" : elle peut
  être utilisée à tout moment, même après l'installation initiale.
