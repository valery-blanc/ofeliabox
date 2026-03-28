# FEAT-004 — Rebrand Ofelia + WiFi AP

**Statut** : DONE
**Date** : 2026-03-28

## Rebrand EduBox → Ofelia
- Portail : titre, h1, footer (FR/EN/ES) → Ofelia
- Logo SVG remplacé par `ofelia.jpg` (portal/assets/ofelia.jpg)
- Dashboard healthcheck : titre + logo
- Moodle SITE_NAME : "Ofelia"

## WiFi AP — NetworkManager (pas hostapd direct)
- Approche : `nmcli con add type wifi ... mode ap ipv4.method shared`
- NM gère hostapd + dnsmasq DHCP automatiquement
- SSID : `Ofelia` | WPA2-PSK : `Ofelia2024`
- IP AP : `192.168.50.1/24`
- DHCP clients : 192.168.50.x (géré par NM)
- DNS captif : `/etc/NetworkManager/dnsmasq-shared.d/captive.conf` → `address=/#/192.168.50.1`
- Autostart : `connection.autoconnect=yes`, `autoconnect-priority=100`
- Lirac_5G (WiFi maison) : `autoconnect=no`

## Service systemd ofelia.service
- Lance `docker compose up -d` au démarrage
- `After=docker.service network-online.target`

## URLs d'accès
| URL | Application |
|---|---|
| http://192.168.50.1/ | Portail Ofelia |
| http://192.168.50.1/moodle/ | Moodle |
| http://192.168.50.1/kolibri/ | Kolibri |
| http://192.168.50.1/biblio/ | Koha OPAC |
| http://192.168.50.1/cgi-bin/koha/mainpage.pl | Koha Staff |
| http://192.168.50.1/status/ | Dashboard |

Note : `http://ofelia` fonctionne aussi si DoH désactivé dans Firefox.
