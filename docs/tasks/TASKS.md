# TASKS — EduBox

## In Progress

### Phase 1 — Infrastructure (SSH + système)
- [x] 1.1 Connexion SSH au Pi (`ssh val@192.168.0.149` avec clé `id_ed25519_pi`)
- [ ] 1.2 Mise à jour système (`apt update && apt upgrade`)
- [ ] 1.3 Installer Docker + Docker Compose
- [!] 1.4 Configurer hostapd + dnsmasq (WiFi AP "EduBox") — BLOQUÉ : eth0 down, SSH via wlan0 uniquement. À faire après branchement câble RJ45
- [!] 1.5 Configurer iptables / NAT (forwarding internet) — BLOQUÉ : dépend de 1.4
- [ ] 1.6 Installer Tailscale
- [ ] 1.7 Configurer swap 1 Go + optimisations SD (noatime, tmpfs)
- [ ] 1.8 Activer watchdog hardware

### Phase 2 — Construction images Docker
- [ ] 2.1 Créer l'arborescence `/opt/edubox/`
- [ ] 2.2 Créer le `.env` avec mots de passe générés (permissions 600)
- [ ] 2.3 Écrire le Dockerfile Kolibri (arm64)
- [ ] 2.4 Écrire le Dockerfile Koha (arm64, Debian Bookworm)
- [ ] 2.5 Écrire la config MariaDB (`edubox.cnf`)
- [ ] 2.6 Écrire le `docker-compose.yml` complet
- [ ] 2.7 `docker compose build` — toutes les images construites
- [ ] 2.8 `docker compose pull` — images officielles téléchargées

### Phase 3 — Portail et Nginx
- [ ] 3.1 Créer la page HTML du portail (FR/EN/ES)
- [ ] 3.2 Créer la config Nginx reverse proxy
- [ ] 3.3 Tester le captive portal (WiFi → redirection portail)

### Phase 4 — Démarrage et vérification
- [ ] 4.1 `docker compose up -d` — tous containers running
- [ ] 4.2 Vérifier MariaDB (`SHOW DATABASES`)
- [ ] 4.3 Vérifier Moodle (`curl http://localhost/moodle/`)
- [ ] 4.4 Vérifier Kolibri (`curl http://localhost/kolibri/`)
- [ ] 4.5 Vérifier Koha OPAC (`curl http://localhost/biblio/`)
- [ ] 4.6 Vérifier Koha Staff (`curl http://localhost/biblio-admin/`)
- [ ] 4.7 Vérifier SIP2 (`telnet localhost 6001`)

### Phase 5 — Import contenu
- [ ] 5.1 Import channels Kolibri (Khan Academy, Wikipedia, etc.)
- [ ] 5.2 Configurer Moodle (langues, cours .mbz)
- [ ] 5.3 Configurer Koha (bibliothèque, types de documents, SIP2)
- [ ] 5.4 Tester scanner USB (si branché)

### Phase 6 — Monitoring et finalisation
- [ ] 6.1 Déployer healthcheck dashboard (`curl http://localhost:8090/`)
- [ ] 6.2 Configurer Tailscale (`tailscale up --ssh --hostname=edubox-001`)
- [ ] 6.3 Configurer backups automatiques (systemd timer)
- [ ] 6.4 Créer le service systemd EduBox (`systemctl status edubox`)
- [ ] 6.5 **Test reboot** — tout redémarre automatiquement
- [ ] 6.6 **Test coupure électrique** — débrancher/rebrancher → tout revient

## Notes
- OS Pi : Debian GNU/Linux 13 (trixie) — pas Bookworm comme attendu dans la spec
- Réseau : wlan0 = accès SSH (192.168.0.149), eth0 = DOWN (pas de câble)
- WiFi AP (hostapd) : à activer après branchement câble RJ45 sur eth0
- Disque : 234 Go disponibles (pas 512 Go comme spec)

## Done
