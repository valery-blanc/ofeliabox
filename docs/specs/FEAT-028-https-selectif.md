# FEAT-028 — HTTPS sélectif : LAN/ZeroTier en HTTPS, AP en HTTP

**Statut** : DONE — 2026-05-06  
**Contexte** : Le port 443 existait mais le certificat auto-signé ne couvrait pas les IPs LAN/ZeroTier ni `canaima`. Les utilisateurs finaux sur l'AP n'ont aucun cert à installer.

---

## Comportement

| Point d'accès | Protocole | Cert à installer |
|--------------|-----------|-----------------|
| Tablettes/smartphones sur WiFi AP (wlan0, 192.168.50.x) | HTTP uniquement | Non |
| LAN ethernet (eth0, 192.168.0.x) | HTTPS | Oui, une fois — `ofelia-ca.crt` |
| Dongle WiFi client (wlan1) | HTTPS | Oui, une fois |
| ZeroTier remote | HTTPS | Oui, une fois |

## Architecture

### Root CA locale
- Fichier : `/opt/edubox/ssl/ofelia-ca.crt` (+ clé privée `ofelia-ca.key`)
- Générée une seule fois par `bootstrap.sh`, validité 10 ans
- Téléchargeable à `http://192.168.50.1/assets/ofelia-ca.crt` (ou via LAN/ZeroTier)
- À installer sur les appareils admin pour obtenir le cadenas vert

### Certificat serveur
- Signé par la Root CA locale, validité 2 ans
- SANs générés dynamiquement par `scripts/regen-ssl.sh` :
  - `DNS:ofelia`, `DNS:ofelia.local`, `DNS:canaima`, `DNS:libofelia`
  - `IP:192.168.50.1`, `IP:127.0.0.1`
  - `IP:<eth0>` si disponible, `IP:<wlan1>` si disponible, `IP:<ZeroTier>` si disponible
- Regénérable via le bouton wizard sans réinstaller la CA sur les appareils

### Blocage HTTPS sur l'AP
- Règle iptables dans la chaîne `DOCKER-USER` (non effacée par Docker) :
  `iptables -I DOCKER-USER -i wlan0 -p tcp --dport 443 -j DROP`
- Persistance via `/etc/systemd/system/ofelia-firewall.service` (s'exécute après `docker.service`)
- Port 80 reste ouvert sur toutes les interfaces (captive portal Android/iOS obligatoire)

## Fichiers modifiés/créés

- `scripts/regen-ssl.sh` (NOUVEAU) — génère le cert serveur avec SANs dynamiques
- `bootstrap.sh` — Root CA + cert signé + service systemd ofelia-firewall
- `nginx/conf.d/edubox.conf` — `canaima libofelia` ajoutés au server_name HTTPS
- `nginx/conf.d/ofelia-locations.inc` — location `/assets/ofelia-ca.crt`
- `setup/app.py` — route `POST /api/ssl/regenerate`
- `setup/templates/index.html` — bouton "Régénérer le certificat SSL" (section WiFi)

## Procédure de renouvellement du cert serveur

Si l'IP du Pi change (ou après 2 ans) :
1. Ouvrir le wizard → section "Connexion internet WiFi"
2. Cliquer "🔐 Régénérer le certificat SSL"
3. Le cert est regénéré avec les IPs courantes, nginx est rechargé automatiquement
4. Aucune action sur les appareils (la CA n'a pas changé)

## Installation de la CA sur les appareils admin

- **Android** : télécharger `/assets/ofelia-ca.crt` → Paramètres > Sécurité > Installer un certificat CA
- **iOS** : télécharger → Réglages > Profil téléchargé > Installer
- **Windows** : double-clic sur le `.crt` → "Autorités de certification racines de confiance"
- **macOS** : double-clic → Trousseau d'accès → Approuver pour SSL
