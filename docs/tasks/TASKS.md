# TASKS — Ofelia (ex-EduBox)

## In Progress

### FEAT-013 — Setup Wizard Web UI — EN COURS 2026-05-01
- [x] `bootstrap.sh` : installation Docker + clone repo + démarrage wizard
- [x] `setup/app.py` : backend Flask, SSE streaming, téléchargement ZIM, génération .env
- [x] `setup/templates/index.html` : UI complète (apps, ZIMs, passwords, console live)
- [x] `portal/credentials.html` : chargement dynamique depuis `credentials-data.json`
- [ ] Pousser sur GitHub (`git push` → `github.com/valery-blanc/ofeliabox`)
- [ ] Tester `bootstrap.sh` sur Pi vierge
- [ ] Committer

### FEAT-012 — Gutenberg ES + Migration SD 512 GB + Profils multi-box — EN COURS 2026-05-01
- [ ] Migration SD : clone Win32DiskImager PC (2 lecteurs USB) + `raspi-config nonint do_expand_rootfs`
- [ ] Télécharger ZIM Gutenberg ES (`gutenberg_es_all_2026-01.zim`, 1.7 Go) sur le Pi
- [x] `docker-compose.yml` : ajouter `gutenberg_es.zim` à la commande kiwix
- [x] `portal/index.html` : carte Gutenberg + i18n 6 langues + fix dot-wikisource
- [x] `profiles/ofelia-es/profile.env` : profil actuel encodé
- [x] `profiles/fr-box/profile.env` : profil box française (Wikipedia FR + Gutenberg FR)
- [x] `scripts/make-box.sh` : script de provisionnement par profil
- [x] `docs/specs/FEAT-012-box-profiles-gutenberg.md` : spec
- [x] `docs/specs/specs_keebee.md` v2.1
- [ ] Déployer sur le Pi + test utilisateur
- [ ] Committer

### FEAT-011 — Bind mounts + scripts install/backup/restore — EN COURS 2026-04-01
- [x] Vérifier noms des volumes Docker (préfixe `edubox_`)
- [x] Créer répertoires `/opt/edubox/data/` avec bons UIDs (999/82/33)
- [x] Mettre à jour `docker-compose.yml` (volumes nommés → bind mounts)
- [x] Migrer données : MariaDB, Moodle, Koha, Digistorm, PMB, SLiMS, Portainer
- [ ] Migrer Kolibri (58 Go — copie en cours en background sur le Pi)
- [x] Créer `scripts/install.sh` (installation Pi neuf)
- [x] Créer `scripts/backup.sh` (backup complet BDD + appdata)
- [x] Créer `scripts/restore.sh` (restauration depuis backup)
- [x] Mettre à jour `scripts/edubox-backup.sh` (ajoute archive appdata)
- [ ] Tester et confirmer stack fonctionnel
- [ ] Supprimer anciens volumes Docker nommés (après 48h de stabilité)
- [ ] Committer

### FEAT-010 — Import cours Moodle depuis Rescate_Moodle_OFELIA — DONE 2026-03-31
- [x] Copie 6 fichiers .mbz sur le Pi (/tmp/)
- [x] docker cp vers container edubox-moodle
- [x] Restauration via php admin/cli/restore_backup.php --categoryid=1
- [x] 6 cours restaurés : taller_cdigital (5), tgb (6), lk (7), centro_de_recursos_académicos (8), mujer_emprende (9), tec (10)

### BUG-009 — Moodle config (CORS + password + site name) — FIXED 2026-03-30
- [x] Fix wwwroot dynamique dans config.php (CORS cross-origin)
- [x] Activation reverseproxy = true
- [x] Reset mot de passe admin (vfeJt38uKwSKZKgnEduBox!) — via script PHP (pas CLI SSH, ! = historique bash)
- [x] Fix policyagreed=1 pour le compte admin (bloquait login web)
- [x] Site name Dockerized_Moodle → Moodle (UPDATE mdl_course id=1)
- [x] Cache purgé (purge_caches.php)

### FEAT-009 — Multilingue (Moodle, Kolibri, Koha, SLiMS, PMB) + URLs portail — DONE 2026-03-30
- [x] Packs langues Moodle téléchargés et installés : es, pt, it, de
- [x] Portail setLang() : Moodle ?lang=XX, Koha opac-changelanguage.pl?language=, SLiMS ?select_lang=
- [x] Portail init : setLang(saved || 'fr') toujours appelé au chargement (fix hrefs par défaut)
- [x] Kolibri : URLs langue par préfixe URL (/kolibri/fr-fr/, /kolibri/es-419/, etc.)
- [x] Koha ES : koha-translate --install es-ES + OPACLanguages=en,es-ES + opaclanguagesdisplay=1
- [x] Koha lang URL : /cgi-bin/koha/opac-changelanguage.pl?language=es-ES → cookie KohaOpacLanguage
- [x] SLiMS : URL /slims/index.php?select_lang=XX (en_US, es_ES, pt_BR, de_DE)
- [x] PMB ES : messages es_ES.xml disponibles (config-based, non URL-switchable)
- [x] Nginx Moodle : Host $http_host (plus Host localhost) — corrige double /moodle/moodle/
- [x] URLs langue intégrées dans i18n (href-moodle, href-kolibri, href-koha, href-slims, href-pmb par lang)
- [x] Kolibri : URLs lang directes nécessitent session → fallback /kolibri/ pour toutes les langues
- [x] Koha : proxy_redirect ~^/$ /biblio/ (opac-changelanguage redirigé vers /biblio/ au lieu d'Ofelia)
- [x] PMB : patch config.inc.php + init.inc.php pour ?lang=XX + cookie pmb_lang (fr_FR/en_US/es_ES/pt_BR/it_IT/de_DE)
- [x] PMB : default_lang=es_ES + user_lang=es_ES pour admin dans DB bibli
- [x] PMB : fichiers patchés copiés dans pmb/includes/ + Dockerfile mis à jour
- [x] Docs FEAT-009-langues-multilangue.md + specs_keebee.md v1.8

### BUG-008 — Koha OPAC page Apache par défaut — FIXED 2026-03-30
- [x] Diagnostic : edubox.conf non activé dans sites-enabled, Host header mismatch, Permission denied sur logs
- [x] Fix : a2ensite + a2dissite 000-default dans entrypoint.sh
- [x] Fix : ServerAlias * ajouté aux vhosts Apache
- [x] Fix : pré-création des fichiers de log (opac-error.log, etc.) avec ownership edubox-koha
- [x] Déploiement + test validé (200 OK sur /biblio/)
- [x] Docs : BUG-008-koha-apache-default-page.md + specs_keebee.md v1.7

### FEAT-008 — Nouvelles apps + refonte tuiles portail — DONE
- [x] 8.1 Logos copiés dans portal/assets/
- [x] 8.2 Portail mis à jour : Koha logo, 2 tuiles Kiwix (Wikipedia+Wikisource), tuiles PMB/SLiMS/Digistorm
- [x] 8.3 Digistorm — Dockerfile + service docker-compose + nginx port 3000
- [x] 8.4 PMB v8.1 — Dockerfile + service docker-compose + nginx /pmb/
- [x] 8.5 SLiMS v9.7.2 — Dockerfile + service docker-compose + nginx /slims/
- [x] 8.6 MariaDB : DB pmb + slims créées, .env mis à jour
- [x] 8.7 Build images Pi (3 images construites avec succès)
- [x] 8.8 docker compose up — redis, digistorm, pmb, slims démarrés
- [x] 8.10 Bouton "← Portail" injecté via sub_filter nginx (Moodle, Kolibri, Koha, PMB, SLiMS, Digistorm)
- [x] 8.11 Page identifiants /credentials.html + tuile portail
- [x] 8.9 PMB et SLiMS opérationnels — schémas importés, services up (200/302)


### Phase 5 — Import contenu
- [x] 5.1 Import channels Kolibri — KA English, KA Español (~37Go total), PhET ES, Sikana ES, African Storybook
- [x] 5.2 Kolibri configuré (setup wizard complété, URL prefix /kolibri)
- [x] 5.3 Koha configuré (web installer, bibliothèque EDUBOX, compte admin)
- [ ] 5.4 Tester scanner USB (si branché)
- [x] 5.5 Wikipedia ES (Kiwix) déployé — tuile portail + /wiki/ — ZIM mini 2026-02 (3.3 Go)
- [x] 5.6 Wikisource ES (Kiwix) ajouté — œuvres libres en espagnol (715 Mo)
- [x] 5.7 Fix viewer Kiwix mobile — iframe plein écran (100dvh, BUG-004)

### Phase 6 — Monitoring et finalisation
- [x] 6.1 Healthcheck dashboard déployé (http://192.168.50.1/status/) — inclut Kiwix
- [x] 6.2 Accès distant via ZeroTier (réseau f3797ba7a8e6a4b5, Pi IP 10.115.169.147)
- [ ] 6.3 Configurer backups automatiques (systemd timer)
- [x] 6.4 Service systemd `ofelia.service` créé et activé
- [x] 6.5 Test reboot — tout redémarre automatiquement (vérifié)
- [ ] 6.6 Test coupure électrique — débrancher/rebrancher → tout revient

### Bugfixes récents
- [x] BUG-001 Fix Koha log dir manquant (crash supervisord sur restart)
- [x] BUG-002 Fix Kiwix upstream port 8080
- [x] BUG-003 Fix Kiwix CSS/JS cassés — `--urlRootLocation=/wiki`
- [x] BUG-004 Fix Kiwix viewer mobile — iframe 100dvh
- [x] BUG-005 Fix Koha OPAC page Apache par défaut — entrypoint vérifie sites-available
- [x] BUG-006 Fix Moodle cassé multi-réseau — sub_filter `$host` dynamique
- [x] BUG-007 Fix Koha OPAC 404 après login — CGI opac-* routés vers staff au lieu d'OPAC (nginx)
- [ ] 6.7 Vérifier contenu interactif Kolibri (PhET) avec ZIP_CONTENT_PORT=8081

## Done

### Phase 1 — Infrastructure
- [x] 1.1 Connexion SSH au Pi (`ssh -i ~/.ssh/id_ed25519_pi val@192.168.0.147`)
- [x] 1.4 WiFi AP "Ofelia" configuré via NetworkManager (SSID=Ofelia, WPA2, 192.168.50.1)
- [x] 1.5 DNS captif : dnsmasq redirige tout vers 192.168.50.1 (portail captif)

### Phase 2 — Construction images Docker
- [x] 2.1 Arborescence `/opt/edubox/` créée sur le Pi
- [x] 2.2 `.env` avec mots de passe générés (permissions 600)
- [x] 2.3 Dockerfile Kolibri (arm64) — image erseco/alpine-moodle
- [x] 2.4 Dockerfile Koha (arm64, Debian Bookworm) — koha-community + fixes
- [x] 2.5 Config MariaDB (`edubox.cnf`)
- [x] 2.6 `docker-compose.yml` complet
- [x] 2.7 `docker compose build` — images Koha et Kolibri construites
- [x] 2.8 `docker compose pull` — images officielles téléchargées

### Phase 3 — Portail et Nginx
- [x] 3.1 Portail HTML créé (FR/EN/ES/PT/IT/DE), rebranded Ofelia avec logo, i18n + localStorage
- [x] 3.2 Nginx reverse proxy configuré (Moodle sub_filter, Kolibri prefix, Koha CGI)
- [x] 3.3 Portail captif fonctionnel — Android ouvre automatiquement http://192.168.50.1/

### Phase 4 — Démarrage et vérification
- [x] 4.1 `docker compose up -d` — tous containers running
- [x] 4.2 MariaDB healthy (koha DB + moodle DB créées)
- [x] 4.3 Moodle accessible (http://192.168.50.1/moodle/)
- [x] 4.4 Kolibri accessible (http://192.168.50.1/kolibri/)
- [x] 4.5 Koha OPAC accessible (http://192.168.50.1/biblio/)
- [x] 4.6 Koha Staff accessible (http://192.168.50.1/cgi-bin/koha/mainpage.pl)
- [x] 4.7 SIP2 exposé port 6001

## Notes techniques
- **Docker DNS** : `/etc/docker/daemon.json` requis avec `{"dns":["8.8.8.8","1.1.1.1"]}` — sans ça, les containers ne résolvent pas les noms externes
- **Kiwix prefix** : toujours utiliser `--urlRootLocation=/<prefix>` — ne pas sub_filter les URLs Kiwix (BUG-003)
- **Kiwix port** : image `ghcr.io/kiwix/kiwix-serve` écoute sur 8080, ENTRYPOINT ajoute déjà `--port=8080` (BUG-002)
- **Koha log dir** : `/var/log/koha/$INSTANCE` doit être créé inconditionnellement dans l'entrypoint (BUG-001)
- **Koha Apache site** : `sites-available/edubox.conf` n'est pas dans un volume Docker — koha/entrypoint.sh vérifie sa présence et relance koha-create si absent (BUG-005)
- **Moodle sub_filter** : toujours utiliser `$host` (variable nginx), jamais une IP codée en dur (BUG-006)

## Notes
- OS Pi : Debian GNU/Linux 13 (trixie)
- IP AP : 192.168.50.1 (wlan0 en mode AP via NetworkManager)
- IP admin (RJ45) : 192.168.0.147 (eth0, DHCP)
- Accès URL principal : http://192.168.50.1/ ou http://ofelia (après désactivation DoH Firefox)
- Moodle wwwroot=http://localhost — nginx sub_filter réécrit vers http://$host/moodle (dynamique)
- Koha : mpm_itk pour koha-create, puis bascule mpm_prefork ; plack-wrapper umask 0
- Kolibri : KOLIBRI_URL_PATH_PREFIX=/kolibri ; nginx proxy_pass http://kolibri/kolibri/
- Kolibri interactive content (H5P) : ZIP_CONTENT_PORT=8081 dans options.ini ; port 8081 exposé dans docker-compose

---

## Durcissement pour le terrain — août 2026

Contexte : la Box part sur un site distant (Canaima, Venezuela) sans personnel
technique. Tout ce qui suit vise le même objectif — qu'une panne se voie, et
qu'une remise en route ne demande personne sur place.

### FEAT-030 — Durcissement (commit `98c99a4`)

- [x] Koha, PMB et SLiMS désinstallés
- [x] Bouton d'extinction propre sur le portail d'administration
- [x] Identifiants déplacés hors du portail public
- [x] Portail d'administration protégé par mot de passe
- [x] Sauvegarde nocturne sur clé USB (`scripts/backup-usb.sh`)
- [x] Script de reprise après sinistre (`scripts/RESTAURER-OFELIA.sh`)
- [x] Page d'attente au lieu des « 502 Bad Gateway »

### BUG-029 / BUG-030 — Wi-Fi (commit `89266ad`)

- [x] La recherche de réseaux force un vrai balayage
- [x] Les SSID contenant un `:` ne cassent plus la liste
- [x] Point d'accès : cause de la lenteur identifiée (WPA1/TKIP, bande `bg`)

### BUG-031 — Clé USB morte (commit `15fd555`)

- [x] Panne rendue visible (bandeau + `GET /api/backup/status`)
- [x] Montage par étiquette et non par UUID : une clé neuve fonctionne sans configuration
- [x] `scripts/preparer-cle-backup.sh`
- [ ] **Clé de remplacement à installer** — sans elle, aucune sauvegarde automatique

### BUG-032 — La Box redémarrait vide (commit `0351e60`)

- [x] `docker stop` retiré de l'extinction (`unless-stopped` refusait de relancer)
- [x] `depends_on` de nginx rétablis (upstreams statiques à l'époque)
- [x] Validé sur le chemin réel : 14/14 conteneurs revenus seuls

### BUG-033 / FEAT-031 / FEAT-032 (commits `78f7b75`, `cf35326`)

- [x] Styles Moodle derrière Traefik (`X-Forwarded-Proto` préservé)
- [x] Calibre consultable sans compte
- [x] Digistorm en accès local, plus de lien mort via le domaine public
- [x] Healthcheck Calibre corrigé (`wget` absent de l'image)

### FEAT-033 — Démarrage ordonné et visible

- [x] nginx en résolution dynamique — il démarre seul et en premier
- [x] Applications en `on-failure:10` — Docker ne les lance plus toutes d'un coup
- [x] `scripts/ofelia-boot.sh` — une application à la fois, dans l'ordre décidé par Val
- [x] Une étape n'est « prête » que si l'application RÉPOND, pas si le conteneur tourne
- [x] `portal/boot.html` — barre de progression, 6 langues, sans ressource externe
- [x] Bascule automatique portail ↔ page de démarrage sur `:80`, `:443`, `:8080`
- [x] Mesures sur horloge monotone (`/proc/uptime`), insensible aux corrections NTP
- [x] Passe de vérification finale des étapes en échec
- [x] `ofelia-boot.service`, `Type=simple` pour ne pas retenir `multi-user.target`

### FEAT-034 — Date, heure et fuseau

- [x] Panneau permanent : date, heure, fuseau, décalage UTC, état NTP
- [x] Sur la page de démarrage (sans mot de passe) et dans l'assistant
- [x] Changement de fuseau — 13/13 essais réussis
- [x] Réglage manuel possible même avec internet (NTP coupé et signalé)
- [x] Bouton de réactivation, affiché seulement si la synchronisation est éteinte
- [x] Instant absolu transmis, jamais une date écrite
- [x] Bornes 2025-2100
- [ ] **Fuseau à confirmer avant le départ** (`America/Caracas` au moment de la clôture)

### FEAT-035 — L'assistant en six langues

- [x] `scripts/i18n_audit_setup.py` — audit des trois sources de texte
- [x] 104 chaînes non traduites → **0**
- [x] 105 clés × 6 langues, aucune vide, aucune orpheline
- [x] Moteur en tête de page (`window.oT`), clé de langue partagée avec le portail
- [x] Tuiles marquées automatiquement via leur `data-id`

### FEAT-036 — Retrait du changement d'image de fond

- [x] Champ, aperçu, envoi et endpoint retirés
- [x] Fonctionnalité constatée cassée (écrivait `background.png`, le portail lit `bg.png`)

### BUG-034 / BUG-035 / BUG-036

- [x] Fuseaux annoncés mais non installés — liste filtrée sur ce que la Box accepte
- [x] Champ d'heure périmé → horloge reculée d'un jour — champ rafraîchi, écart confirmé
- [x] État de démarrage figé — revérification des échecs à la lecture

### Infrastructure

- [x] Unités systemd versionnées dans `systemd/` et réinstallées par `RESTAURER-OFELIA.sh`
- [ ] **Push GitHub** — le dépôt sur la Box a un remote HTTPS sans identifiants

## Notes techniques (durcissement)

- **`restart: unless-stopped`** signifie « relance, *sauf s'il a été arrêté
  délibérément* ». Un `docker stop` explicite empêche donc le redémarrage au
  boot suivant (BUG-032).
- **`proxy_pass $variable`** transmet l'URI d'origine telle quelle, là où la
  forme statique retirait le préfixe de la location. Un `rewrite … break` est
  nécessaire à chaque conversion (FEAT-033).
- **Le Pi 5 n'a pas de pile d'horloge.** Sans NTP, l'heure repart de la
  dernière valeur enregistrée. Ne jamais chronométrer avec l'heure murale
  pendant le démarrage : utiliser `/proc/uptime` (FEAT-033, BUG-035).
- **`timedatectl list-timezones` ment** : 598 annoncés, 487 installés. Filtrer
  sur les fichiers réellement présents (BUG-034).
- **Depuis un conteneur, `localhost` n'est pas l'hôte.** Les URL écrites par un
  script de l'hôte doivent être traduites avant usage (BUG-036).
- **Un champ pré-rempli avec « maintenant » devient faux** dès que la page
  reste ouverte. Le rafraîchir, et envoyer `Date.now()` s'il n'a pas été
  modifié (BUG-035).
