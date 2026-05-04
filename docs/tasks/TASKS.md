# TASKS — Ofelia (ex-EduBox)

## In Progress

### BUG-025 — Wizard Kolibri : 3 tuiles Khan Academy EN/ES/FR — DEPLOYE 2026-05-04
- [x] Diagnostic : `khan_es` avait l'ID du canal anglais (`1ceff53605e55bef987d88e0908658c5`)
- [x] IDs corrects vérifiés via communauté Learning Equality : EN=`1ceff…`, ES=`c1f2b7…`, FR=`878ec2…`
- [x] `setup/app.py` : ajout `khan_en`, correction IDs `khan_es` et `khan_fr`
- [x] `setup/templates/index.html` : ajout tuile Khan Academy EN
- [x] Déployé sur Pi + restart `edubox-setup`
- [ ] Tester le wizard — vérifier les 3 tuiles et lancer DL khan_es
- [ ] Committer

### FEAT-021 — Enrichissement bibliothèque Calibre (BNE dump + OL + WD) — DONE 2026-05-04
- [x] Spec v2 : `docs/specs/FEAT-021-calibre-enrichment.md`
- [x] Patch BNE-pivot : `docs/specs/calibre-enrichment-spec-v2-bne-patch.md`
- [x] Diagnostic : identifiants HF = IDs BDH, pas IA — IA/OL/WD inutilisables directement
- [x] Dump BNE `dominiopublico_csv-utf8.zip` (~57 Mo) — 167 944 BDH IDs, 67% Tema, 39% Genre
- [x] Liaison : `version_digital` URL → `?id=XXXXXXXXXX` = identifiant HF → 49% couverture
- [x] `setup/scripts/calibre_enrich.py` : pipeline complet (load-bne-dump, extract, enrich, bake, import-db, report)
- [x] `load-bne-dump` : index SQLite en 2.7s depuis ZIP local ou URL
- [x] `fetch_bne_local` : lookup thread-safe O(1) dans bne_index.db
- [x] `map_tgfbne` : mapping direct Género/Forma → category (TGFBNE_MAP)
- [x] Test 200 livres : 62% >=3 tags, 32% catégorie, siècles 100%
- [x] 150 555 livres dans books-output (populate_books terminé)
- [x] Committer

### BUG-020 — Wizard inaccessible après redémarrage — FIXED 2026-05-02
- [x] Créer `setup/Dockerfile` (Python + Docker CLI + Compose plugin)
- [x] Ajouter service `setup` dans `docker-compose.yml`
- [x] `bootstrap.sh` : remplacer nohup par `docker compose up -d --build setup`
- [x] Déployé sur Pi — edubox-setup Up, HTTP 200
- [ ] Tester après reboot Pi
- [x] Committer (890199d)

### BUG-021 — Moodle redirect localhost — FIXED 2026-05-02
- [x] `nginx/conf.d/edubox.conf` : `proxy_redirect http://localhost/moodle/`
- [x] `nginx/conf.d/edubox.conf` : double `sub_filter` localhost→$http_host (HTML + JSON-encoded)
- [x] `moodle/99-fix-wwwroot.sh` : `chmod +x` sur Pi
- [x] Purge caches Moodle
- [x] Déployé + nginx reloadé — 0 localhost URL restant (hors body CSS class)
- [x] Tester login Moodle depuis 192.168.0.147 — OK 2026-05-02
- [ ] Tester portail (hard refresh pour BUG-023 wikisource)
- [x] Committer (890199d)

### BUG-022 — Kolibri import Khan Academy échoue — FIXED 2026-05-02
- [x] `setup/app.py` : `_wait_for_healthy("edubox-kolibri")` avant import
- [x] `setup/app.py` : meilleure gestion d'erreur import
- [x] Déployé sur Pi
- [ ] Tester via wizard (recoche Khan Academy + réinstalle)
- [x] Committer (890199d)

### BUG-023 — Tuiles portail non filtrées — FIXED 2026-05-02
- [x] `portal/index.html` : fetch `/wizard-state.json` + masquer tuiles non installées
- [x] `nginx/conf.d/edubox.conf` : location pour servir les fichiers JSON du portail
- [x] Déployé sur Pi — wizard-state.json HTTP 200
- [x] Tester portail (vérifier tuiles visibles/masquées selon wizard-state) — OK 2026-05-02
- [x] Committer (890199d)

### BUG-024 — Mot de passe Moodle non appliqué + credentials incomplets — FIXED 2026-05-02
- [x] `setup/app.py` : reset password Moodle via `docker exec ... reset_password.php`
- [x] `portal/credentials.html` : `data-cred` attributs sur Koha, PMB, SLiMS, Kolibri
- [x] `nginx/conf.d/edubox.conf` : location JSON → credentials-data.json HTTP 200
- [x] Pi : credentials-data.json mis à jour avec mot de passe Moodle réel (vfeJt38uKwSKZKgnEduBox!)
- [x] `setup/templates/index.html` : hint politique de mot de passe Moodle
- [x] Tester page /credentials.html → identifiants corrects affichés — OK 2026-05-02
- [x] Committer (890199d)

### FEAT-017 — Tests santé services après installation — DONE 2026-05-02
- [x] `setup/app.py` : `_wait_for_healthy()` + `_report_health()` fonctions
- [x] `setup/app.py` : rapport health check en fin d'installation
- [x] Committer (890199d)

### FEAT-018 — Upload image de fond dans wizard — DONE 2026-05-02
- [x] `setup/app.py` : route `POST /api/upload-background`
- [x] `setup/templates/index.html` : champ upload + preview
- [x] Committer (890199d)

### FEAT-019 — HTTPS + domaine ofelia — DONE 2026-05-02
- [x] Spec technique : Option A (auto-signé), $scheme:// pour Moodle
- [x] `bootstrap.sh` : étape SSL (openssl req, idempotent, /opt/edubox/ssl/)
- [x] `docker-compose.yml` : port 443 + volume /opt/edubox/ssl → /etc/nginx/ssl
- [x] `nginx/conf.d/edubox.conf` : map $back_btn + serveur HTTPS port 443 + include
- [x] `nginx/conf.d/ofelia-locations.inc` : locations partagées HTTP/HTTPS
- [x] Déployer sur Pi + tester https://192.168.50.1/ — OK 2026-05-02
- [x] Committer (890199d)

### FEAT-016 — Auto-installation Koha / PMB / SLiMS sans interface web — DONE 2026-05-02
- [x] `pmb/entrypoint.sh` : wait MariaDB + db_param.inc.php + opac_db_param.inc.php + import SQL + admin password (PHP hash)
- [x] `pmb/Dockerfile` : ajout `default-mysql-client` + ENTRYPOINT
- [x] `slims/entrypoint.sh` : wait MariaDB + database.php + import SQL (DDL puis data) + admin password
- [x] `slims/Dockerfile` : ajout `default-mysql-client` + ENTRYPOINT
- [x] `koha/setup-admin.pl` : script Perl branche/catégorie/superlibrarian
- [x] `koha/Dockerfile` : COPY setup-admin.pl
- [x] `koha/entrypoint.sh` : bloc schema + admin + Version pref (format transformé "25.1104000")
- [x] `setup/app.py` : KOHA/PMB/SLIMS_ADMIN_PASS dans .env + credentials-data.json
- [x] `docker-compose.yml` : KOHA/PMB/SLIMS_ADMIN_PASS passés aux containers
- [x] Rebuild images (koha + pmb) sur Pi
- [x] BUG-019 : Koha maintenance loop (Version format) — FIXED
- [x] PMB OPAC `opac_db_param.inc.php` créé — FIXED
- [x] `portal/credentials-data.json` créé sur Pi
- [x] Koha : 200 ✓ | PMB gestion : 200 ✓ | PMB OPAC : 200 ✓ | SLiMS : 200 ✓
- [x] Tester login : koha_admin / PMB admin / SLiMS admin — OK 2026-05-02
- [x] Committer (dans commit 890199d)

### BUG-018 — MariaDB mot de passe régénéré au re-run wizard — FIXED 2026-05-01
- [x] `setup/app.py` : `_write_env()` préserve les mots de passe existants du `.env`
- [x] `setup/app.py` : `_patch_kiwix()` préserve les ZIM déjà installés
- [x] `docker-compose.yml` : Kiwix healthcheck → `wget --spider /wiki`
- [x] Pi : MariaDB wiped + réinitialisé avec mots de passe corrects
- [x] Pi : DB koha/pmb/slims créées + mots de passe fixés
- [x] Pi : init SQL scripts déployés (`mariadb/init/`)
- [x] Pi : nginx redémarré (IPs containers obsolètes)
- [x] Committer (890199d)

### BUG-017 — Wizard état non persisté — DONE 2026-05-02
- [x] `setup/app.py` : écrire `wizard-state.json` après install + route GET /api/state
- [x] `setup/templates/index.html` : lire `/api/state` au chargement et cocher les bonnes cases
- [x] Déployé sur Pi + fonctionnel
- [x] Committer (890199d)

### FEAT-014 — Kolibri canaux Khan Academy dans wizard — DONE 2026-05-02
- [x] Identifier channel IDs Khan Academy ES et FR
- [x] `setup/app.py` : catalogue KOLIBRI_CHANNELS + fonction `_import_kolibri_channel()`
- [x] `setup/templates/index.html` : groupe "Kolibri" dans section bibliothèques
- [x] Déployé sur Pi + fonctionnel
- [x] Committer (890199d)

### FEAT-020 — Refonte visuelle portail (Claude Design) — DONE 2026-05-03
- [x] Lire bundle Claude Design (design system, chats, HTML prototype)
- [x] Extraire assets : bg.png (650KB) + logo.png (86KB) → portal/assets/
- [x] Réécriture portal/index.html : vanilla JS, thème burgogne/crème, cards solid color
- [x] Déployer sur Pi (fichiers statiques, pas de rebuild)
- [x] Créer FEAT-020-refonte-portail-design.md + specs_keebee.md v2.5

### FEAT-015 — Bibliothèque HuggingFace livres espagnols — IN PROGRESS
- [x] Rechercher format dataset + taille totale (Parquet, 52 Go, 302k livres)
- [x] Évaluer option Calibre-web (arm64) (OK, ~245 Mo, conversion EPUB requise)
- [x] Proposer spec technique (pipeline Parquet → EPUB → Calibre-web)
- [x] Service calibre dans docker-compose.yml (calibre + nginx depends_on)
- [x] Script populate_books.py (pyarrow + ebooklib, datasets-server API, reprise auto)
- [x] Intégrer dans wizard : setup/app.py + templates/index.html (checkbox + shards)
- [x] Nginx location /calibre/ (X-Script-Name, proxy_redirect)
- [x] Portail : tuile Calibre-Web + i18n 6 langues + visibilité wizard-state
- [x] Mode hors-ligne : `--local-dir` populate_books.py + détection auto app.py
- [x] Fix mémoire setup container : 128M → 512M
- [x] scp 3 shards PC → Pi → 2 835 livres importés
- [x] Rebuild image setup + déployer
- [x] Tester sur Pi — Calibre-Web accessible, livres visibles
- [x] Fix schéma metadata.db (library_id, uuid, custom_columns, identifiers)
- [x] Fix dates ISO dans populate_books.py (_to_iso_date)
- [x] Fix nginx /calibre/ (proxy_pass trailing slash)
- [x] Fix _configure_calibre_web() (login + POST /admin/dbconfig)
- [x] Committer

### BUG-010 — Fresh install bind mounts vides — FIXED 2026-05-01
- [x] Moodle : supprimer bind mount `html:` dans docker-compose.yml
- [x] PMB : volume nommé `pmb_includes:` dans docker-compose.yml
- [x] SLiMS : volume nommé `slims_config:` dans docker-compose.yml
- [x] Committer (avec BUG-011)

### BUG-011 — Koha fresh install : koha-create avorte — FIXED 2026-05-01
- [x] `docker-compose.yml` : bind mount `/etc/koha/sites` au lieu de `/etc/koha`
- [x] `koha/entrypoint.sh` : déplacer création `/var/log/koha/$INSTANCE` après koha-create
- [x] Rebuild image + recréer container + test URLs
- [x] Committer (890199d)

### BUG-012 — Kolibri faux unhealthy — FIXED 2026-05-01
- [x] `docker-compose.yml` : corriger URL healthcheck `/kolibri/api/public/info/`
- [x] Committer (890199d)

### BUG-013 — Digistorm build npm install — FIXED 2026-05-01
- [x] `setup/app.py` : fonction `_prepare_digistorm()` clone depuis Codeberg
- [x] Committer (890199d)

### FEAT-013 — Setup Wizard Web UI — EN COURS 2026-05-01
- [x] `bootstrap.sh` : installation Docker + clone repo + démarrage wizard
- [x] `setup/app.py` : backend Flask, SSE streaming, téléchargement ZIM, génération .env
- [x] `setup/templates/index.html` : UI complète (apps, ZIMs, passwords, console live)
- [x] `portal/credentials.html` : chargement dynamique depuis `credentials-data.json`
- [x] Pousser sur GitHub (`git push` → `github.com/valery-blanc/ofeliabox`) — 2026-05-02
- [ ] Tester `bootstrap.sh` sur Pi vierge
- [x] Committer (890199d)

### FEAT-012 — Gutenberg ES + Migration SD 512 GB + Profils multi-box — EN COURS 2026-05-01
- [x] Migration SD : clone Win32DiskImager PC (2 lecteurs USB) + `raspi-config nonint do_expand_rootfs`
- [x] Télécharger ZIM Gutenberg ES (`gutenberg_es_all_2026-01.zim`, 1.7 Go) sur le Pi
- [x] `docker-compose.yml` : ajouter `gutenberg_es.zim` à la commande kiwix
- [x] `portal/index.html` : carte Gutenberg + i18n 6 langues + fix dot-wikisource
- [x] `profiles/ofelia-es/profile.env` : profil actuel encodé
- [x] `profiles/fr-box/profile.env` : profil box française (Wikipedia FR + Gutenberg FR)
- [x] `scripts/make-box.sh` : script de provisionnement par profil
- [x] `docs/specs/FEAT-012-box-profiles-gutenberg.md` : spec
- [x] `docs/specs/specs_keebee.md` v2.1
- [x] Déployer sur le Pi + test utilisateur
- [x] Committer

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
