# ⏭️ REPRISE — état au 11/09/2026

## ✅ Réconciliation des branches — FAITE (2026-09-11)

**`box-durcissement-2026-08` est fusionnée.** La divergence qui empoisonnait
chaque déploiement depuis le 21 août est close : plus de « la Box a raison mais
le dépôt l'ignore », plus de risque de réécraser le durcissement comme le
2026-08-25 (BUG-039).

- Branche du résultat : **`reconciliation-2026-09-11`** — ⛔ **pas encore
  fusionnée dans `master`, pas poussée.** Elle attend le test de Val.
- Sauvegarde avant opération :
  `C:\WORK\_snapshots\keebee-avant-reconciliation-20260911.bundle`
  (historique complet, vérifié par `git bundle verify`).

**Méthode** : pour chacun des 9 fichiers en conflit, les deux côtés ont été
comparés **structurellement** — fonctions, routes Flask, services compose, blocs
`location` nginx — et non à l'œil. La version de la Box s'est révélée un
sur-ensemble partout, **à deux exceptions près**, qui auraient disparu en
silence sous un « prendre la version Box » :

1. `/api/upload-background` — la seule route que `master` avait en propre.
   **Reportée.**
2. Le correctif de cache du guide (`55bf675`, `Cache-Control: no-cache` au lieu
   d'`expires 1d`). **Reporté** dans le bloc `/bibliofelia/docs/`.

**Ce que la fusion entérine** — décisions déjà prises, désormais dans le dépôt :
Koha, PMB et SLiMS désinstallés (FEAT-030, démarrage 15 min → 5 min, données
conservées) ; démarrage ordonné FEAT-039 ; `TZ` sur `bibliofelia` et
`bibliofelia-worker` — **la dette du Sprint 29 est soldée par la fusion
elle-même**, la Box l'avait déjà ; Digistorm 1.2.0 complet (88 fichiers,
`server/app.js` remplace l'ancien `server/index.js`).

**Non reporté, volontairement** : le *champ* « image de fond du portail » de
l'assistant. Le gabarit de la Box est en six langues et n'a plus le champ après
lequel il s'insérait (les identifiants ont leur propre page depuis FEAT-044) ;
y greffer du français en dur casserait le gate i18n. La route reste appelable,
sans bouton — à Val de décider si la fonctionnalité revient.

**Vérifications** : aucun fichier de `master` perdu ; routes Flask 13 → 31,
aucune perdue ; syntaxe Python et YAML valides ; aucun marqueur de conflit
résiduel ; durcissement conservé (`set-password`, `sd-health`, `boot-status`)
**et** fonctionnalités de `master` conservées (`_prepare_bibliofelia`, ZeroTier,
`BIBLIOFELIA_SECRET_KEY`).

### Ce qu'il reste à faire

- [ ] **Test fonctionnel de Val** sur `reconciliation-2026-09-11`.
- [ ] Puis : fusionner dans `master`, pousser, et **redéployer la Box depuis
      cette branche** — c'est ce déploiement qui appliquera enfin BUG-048.
- [ ] Supprimer la branche `box-durcissement-2026-08` une fois `master` à jour.

---

## 🔴 La Box n'a aucune sauvegarde durable — mesuré le 2026-09-10

Les deux chemins sont hors service **en même temps** :

- `ofelia-backup.timer` échoue **toutes les nuits** depuis au moins le 8
  septembre : `clé USB absente de /mnt/backup` (BUG-031, clé morte jamais
  remplacée) ;
- côté BibliOfelia, les sauvegardes horaires écrivent dans `/backup`, **qui
  n'est monté nulle part** — elles vivent dans le conteneur worker et
  disparaissent à chaque reconstruction.

Aucune de ces deux causes n'est nouvelle. Elles ne s'étaient simplement jamais
additionnées de façon aussi visible. À trancher : monter `/backup` sur l'hôte
(une ligne de compose) et/ou remplacer la clé.

---

# Historique — reprise au 27/08/2026

**Dernier commit :** voir `git log -1` sur `/opt/edubox` — branche
**`box-durcissement-2026-08`** (⛔ jamais `master` : le dépôt de la Box a divergé
de 22 commits, un push direct effacerait du travail).

**Déploiement :** la Box **est** la cible. Ce qui tourne dessus est ce qui est
committé. 14/14 conteneurs, toutes les routes répondent.

**Tests :** ⛔ **pas de suite automatisée sur ce dépôt.** Les vérifications sont
des sondes HTTP et des rejeux de logique, faites au fil de la session. Deux
harnais existent néanmoins et sont à jour :
`setup/tests/test_masquage.mjs` (8 contrôles, verts) et
`scripts/test_stall_watch.py` (6 scénarios + trace réelle, verts).
**Ne jamais annoncer un « total de tests » pour ce dépôt : il n'y en a pas.**

## 🔴 À FAIRE EN PREMIER

1. **Renvoyer la carte SD 512 Go à digitec.** Tout ce qu'elle contenait
   d'irremplaçable est sauvegardé et **vérifié** dans
   `C:\WORK\Backups\ofeliabox` sur Bruxelles (bibliothèque Calibre :
   150 555 livres, correspondance catalogue ↔ archive exhaustive, 0 manquant).
   Motif de garantie : `mmc0: Card stuck being busy`, 33 blocages en 22 min,
   86 % du temps immobilisée — et **0 blocage avec une autre carte dans le même
   lecteur**. Détail dans `docs/bugs/BUG-038-carte-sd-calages.md`.
2. **Clé USB de sauvegarde : toujours absente.** `ofelia-backup.timer` est armé
   mais n'écrit nulle part. Script jamais exécuté pour de vrai :
   `sudo /opt/edubox/scripts/preparer-cle-backup.sh`.
   *Signal d'échec à guetter* : `findmnt -n -t ext4 /mnt/backup` sans réponse.
3. **Le dongle Wi-Fi n'est PAS fiable** — voir réfutations ci-dessous.

## 🧨 RÉFUTÉ — ne pas rebâtir

- **« Le port USB 2.0 règle le dongle »** — annoncé après **deux minutes**
  d'observation. Le compteur réel de la même session : 19 déconnexions. Le port
  noir améliore nettement, il ne règle pas.
- **« Le type de port est indifférent puisque l'adaptateur déclare
  `bcdUSB 2.00` »** — faux dans l'autre sens.
- **« Le noyau 6.18.39 corrigera le pilote »** — essayé le 2026-08-26 :
  3,2 déconnexions/min contre 3,8 en 6.18.34, **jamais d'association**. Retour
  en 6.12 impossible, le dépôt ne le propose plus.
- **« La chaleur cause les calages de la carte »** — le ventilateur a fait
  passer la Pi de 70,8 à 36,7 °C **sans rien changer** aux blocages.
- **« Un superbloc propre innocente le support »** — il décrit l'état des
  *données*, pas la santé du *matériel*. Lire `dmesg` **d'abord**.
- **« La clé USB morte bloque le démarrage »** — `preparer-cle-backup.sh` pose
  `nofail` + `x-systemd.automount`. Vérifiable par un `git grep fstab`.

## ⏳ Ouvert, avec le motif

- **Dongle Wi-Fi `rtw89_8852bu`** : matériel **sain** (testé sur Bruxelles,
  `ProblemCode 28` = pilote absent), mais le pilote Linux le rend inutilisable
  et **il a fait planter la Box deux fois**. Il est désactivé. À Canaima il ne
  sert à rien (aucun réseau) — la question ne se pose que chez Val.
  Piste sans achat : le Wi-Fi **interne** accepte AP + client simultanés
  (`#channels <= 1`, donc même canal).
- **`populate_books.py` cassé** (BUG-044) : `table books has no column named
  uuid`, et il annonce « terminé » en produisant 0 livre. Sans importance tant
  que la bibliothèque restaurée tient, bloquant si elle devait être refaite.
- **Sauvegarde incomplète** : ni Kolibri, ni la bibliothèque Calibre, ni le code
  de Digistorm n'étaient dans `backup-usb.sh`. C'est ce qui a rendu le
  remontage long.
- **Fuseau `America/Caracas`** : tranché par Val, assumé — 6 h de décalage tant
  que la Box est en Europe.

---

# 🗄️ REPRISE du 2026-08-23 — **supplantée par celle du 27/08 ci-dessus**



**Dernier commit :** `fa885f3` — FEAT-033..036 (démarrage ordonné, heure et
fuseau, assistant en 6 langues). Poussé sur GitHub, branche
**`box-durcissement-2026-08`**.

**Déploiement :** la Box tourne ce code. 14/14 conteneurs, tous les services
répondent, séquence de démarrage 8/8.

**Tests :** pas de suite automatisée sur ce dépôt. Les vérifications sont des
sondes HTTP et des rejeux de logique, faites au fil de la session sur le
commit `fa885f3`.

## 🔴 À FAIRE EN PREMIER

1. **Le câble réseau de la Box est débranché** (`eth0` sans lien depuis le
   démarrage du 2026-08-23). Conséquences : `192.168.0.147` ne répond plus, et
   `canaima.bibliofelia.org` renvoie 502 puisque Traefik route vers cette IP.
   La Box est joignable en attendant sur **`192.168.0.204`** (Wi-Fi `Lirac_5G`)
   et **`10.115.169.147`** (ZeroTier).
   *Signal de retour à la normale :* `cat /sys/class/net/eth0/carrier` = `1`.

2. **Clé USB de sauvegarde à installer** : `sudo /opt/edubox/scripts/preparer-cle-backup.sh`.
   ⚠️ Ce script **n'a jamais été exécuté pour de vrai** — syntaxe validée
   seulement. Le tester pendant que la Box est à portée de main.

3. **Fuseau horaire à trancher** : la Box est en `America/Caracas`. Juste pour
   Canaima, mais tant qu'elle est en Europe les dates BibliOfelia s'affichent
   avec 6 h de décalage.

## 🧨 RÉFUTÉ pendant la session — ne pas rebâtir

- **« La clé USB morte empêche le démarrage »** — hypothèse plausible mais
  jamais démontrée, et le symptôme est revenu sans la clé. Écartée.
- **« La Box ne démarre pas »** (trois fois de suite le 2026-08-22) — faux à
  chaque fois. Elle démarrait, mais je ne testais que `192.168.0.147` alors
  qu'elle répondait sur son Wi-Fi et par ZeroTier. **La Box a jusqu'à quatre
  adresses : toujours les tester toutes avant de conclure à une panne.**
- **« BibliOfelia ne répond pas » au démarrage** — c'était un verdict figé,
  pas un constat (BUG-036). L'application fonctionnait.
- **« Le réglage manuel de l'heure protège l'horloge »** — il l'a faussée
  (BUG-035). Une fonction de correction peut devenir la cause.

## ⏳ Reste ouvert, avec le motif

- **Push sur `master`** : le dépôt de la Box a divergé (ancêtre commun
  `6c090c3`, 22 commits côté GitHub, 8 côté Box). La fusion demandera de
  vrais arbitrages sur `setup/app.py`, `docker-compose.yml` et les configs
  nginx — c'est une décision de Val, pas un rattrapage mécanique.
- **`bootstrap.sh` sur Pi vierge** : jamais rejoué depuis le durcissement.
- **Migration SD, volumes Docker anciens, scanner USB, PhET/Kolibri** :
  antérieurs à ce chantier, non traités ici.

---

# TASKS — Ofelia (ex-EduBox)

## In Progress

### FEAT-029 — Intégration BibliOfelia dans le wizard Ofelia — DONE 2026-05-22
- [x] Spec `docs/specs/FEAT-029-bibliofelia.md` rédigée
- [x] `setup/app.py` : entrée `bibliofelia` dans `APPS`, `_prepare_bibliofelia()` (clone GitHub), `_create_dirs` (data/media), `_write_env` (`BIBLIOFELIA_SECRET_KEY`), container map `_report_health`, ajout `bibliofelia-worker` à la liste des services
- [x] `setup/templates/index.html` : carte BibliOfelia (badge Optionnel)
- [x] `docker-compose.yml` : services `bibliofelia` + `bibliofelia-worker` (build `./bibliofelia`, edubox-net, bind-mount avahi, healthcheck-driven worker)
- [x] `nginx-proxy` : montage des volumes `bibliofelia_static` (RO) et `/opt/edubox/data/bibliofelia/media` (RO)
- [x] `nginx/conf.d/ofelia-locations.inc` : `location /bibliofelia/`, `/bibliofelia/static/`, `/bibliofelia/media/` (résolveur dynamique pour ne pas bloquer nginx si non installé)
- [x] `portal/index.html` : tuile BibliOfelia (couleur green) + i18n 6 langues + `applyWizardState` filtre
- [x] `healthcheck/app.py` : entrée `bibliofelia`
- [x] `bootstrap.sh` : installation `avahi-daemon` + `avahi-utils` (pour mDNS `_bibliofelia._tcp.`)
- [x] `specs_keebee.md` v3.4 — apps listées + référence FEAT-029
- [x] Déploiement sur Pi `192.168.0.147` + test Val (portail → wizard → bibliofelia) — OK 2026-05-22
- [x] Commit unique : code + docs + TASKS.md — validé Val 2026-05-22

### FEAT-028 — HTTPS sélectif : LAN/ZeroTier HTTPS, AP HTTP — DONE 2026-05-06
- [x] `scripts/regen-ssl.sh` — Root CA + cert serveur avec SANs dynamiques (eth0, wlan1, ZeroTier)
- [x] `bootstrap.sh` — Root CA + cert signé + service systemd ofelia-firewall (iptables wlan0 → DROP 443)
- [x] `nginx/conf.d/edubox.conf` — canaima et libofelia ajoutés au server_name HTTPS
- [x] `nginx/conf.d/ofelia-locations.inc` — `/assets/ofelia-ca.crt` exposé en téléchargement
- [x] `setup/app.py` — route POST /api/ssl/regenerate (container : edubox-nginx)
- [x] `setup/templates/index.html` — bouton "Régénérer le certificat SSL" + JS sslRegenerate()
- [x] Avignon : `~/docker/traefik/dynamic/ofelia.zitoon.com.yml` — Let's Encrypt, cadenas vert sans installation
- [x] Créer `docs/specs/FEAT-028-https-selectif.md`
- [x] Mettre à jour `docs/specs/specs_keebee.md` v3.3
- [x] Déployer sur le Pi + tester — OK 2026-05-06
- [x] Commit

### FEAT-026 — Mot de passe Calibre-Web dans le wizard — DONE 2026-05-05
- [x] Champ calibre-pass dans section Configuration (hint : appliqué si tuile sélectionnée)
- [x] passwords.calibre_admin dans payload install + restore depuis /api/current-config
- [x] CALIBRE_ADMIN_PASS dans .env (_write_env + _get existant)
- [x] _set_calibre_password() : hash scrypt via werkzeug dans docker exec edubox-calibre
- [x] Appelé après _configure_calibre_web() dans _install_stream
- [x] Déployer + vérifier — OK 2026-05-05
- [x] Créer FEAT-026-calibre-password-wizard.md
- [x] Mettre à jour specs_keebee.md v3.2

### FEAT-025 — Calibre-Web : tuile dans grille Applications (import manuel) — DONE 2026-05-05
- [x] Supprimer section "Bibliothèque numérique" (shards, HuggingFace, parquet)
- [x] Ajouter tuile "Calibre-Web" dans la grille Applications (badge Optionnel)
- [x] Supprimer JS : calibreEnabled, toggleCalibre(), updateCalibeSummary()
- [x] Supprimer calibre:{enabled,shards} du payload install et wizard-state
- [x] Ajouter calibre à APPS dans app.py + supprimer CALIBRE_SHARDS_DEFAULT
- [x] Remplacer bloc HuggingFace par post-startup calibre simplifié dans _install_stream
- [x] Déployer sur Pi + tester — OK 2026-05-05
- [x] Créer FEAT-025-calibre-web-tile-simplified.md
- [x] Mettre à jour specs_keebee.md v3.1

### FEAT-024 — Wizard : WiFi AP (SSID + mot de passe) inline + Modifier — DONE 2026-05-05
- [x] Champ ap-pass ajouté à côté de box-name (même ligne, classe .ap-row)
- [x] Bouton Modifier applique nmcli con mod sans relancer l'installation
- [x] Route POST /api/ap/update + _do_apply_ap_config() sync
- [x] BOX_NAME et AP_PASS persistés dans .env
- [x] GET /api/current-config retourne ap_pass (depuis .env ou nmcli -s)
- [x] Dockerfile setup : WORKDIR /opt/edubox/setup, suppression des COPY (live reload)
- [x] Rebuild image setup + déployer — OK 2026-05-05
- [x] Créer FEAT-024-wizard-wifi-ap-config.md
- [x] Mettre à jour specs_keebee.md v3.1

### BUG-027 — Calibre-Web erreur 500 : table library_id absente — FIXED 2026-05-05
- [x] Diagnostic : metadata.db importée sans table library_id (version Calibre ancienne)
- [x] Fix : CREATE TABLE library_id + INSERT uuid4 via sqlite3 dans le container
- [x] Vérifier : docker compose restart calibre → OK, Calibre-Web accessible
- [x] Créer BUG-027-calibre-library-id-missing.md
- [x] Mettre à jour specs_keebee.md (règle metadata.db)

### FEAT-023 — Identifiants Calibre + bouton modifier
- [x] Lire et valider spec
- [x] Créer doc FEAT-023
- [x] Ajouter bloc Calibre dans credentials.html + mode édition JS
- [x] Ajouter route POST /api/update-credentials dans setup/app.py
- [x] Ajouter calibre dans _write_credentials()
- [x] Ajouter proxy /setup-api/ dans ofelia-locations.inc
- [x] Déployer sur Pi — OK 2026-05-05
- [x] Mettre à jour specs_keebee.md v3.0
- [x] Tester sur Pi (page /credentials.html + bouton Modifier) — OK 2026-05-05
- [x] Commit

### FEAT-022 — Double WiFi : dongle USB WiFi6 + wizard connexion internet — DONE 2026-05-04
- [x] Spec : `docs/specs/FEAT-022-wifi-dongle-maintenance.md`
- [x] `setup/Dockerfile` : ajouter `network-manager` (nmcli)
- [x] `docker-compose.yml` : volume `/run/dbus` + `cap_add: NET_ADMIN` sur service setup
- [x] `setup/app.py` : routes `/api/wifi/interfaces`, `/api/wifi/scan`, `/api/wifi/connect`, `/api/wifi/status`
- [x] `setup/templates/index.html` : section "Connexion internet WiFi" + JS
- [x] Rebuild image setup + déployer sur Pi — OK 2026-05-04
- [x] nmcli parle au NM hôte via D-Bus — vérifié (voit wlan0 + toutes ifaces)
- [x] /api/wifi/interfaces, /api/wifi/scan, /api/wifi/status — répondent correctement (found:false sans dongle)
- [x] Tester avec dongle branché : scan 20 réseaux visible, /api/wifi/interfaces found:true — OK 2026-05-04
- [x] Fix driver : RTL8852BU DKMS morrownr/rtl8852bu-20250826 + rtw_low_power=0 + update-initramfs
- [x] Mettre à jour `docs/specs/specs_keebee.md` v2.8 + FEAT-022 notes driver
- [x] Panneau réseau : `GET /api/network/status` (nmcli device show, no `ip` binary) — déployé 2026-05-04
- [x] Panneau réseau : HTML/CSS/JS `.net-panel` dans index.html — auto-refresh 20s + ZeroTier via /sys/class/net
- [x] Testé : panneau affiché + ligne ZeroTier visible — OK 2026-05-04

### BUG-026 — ZeroTier absent du wizard (installé manuellement) — DONE 2026-05-04
- [x] BUG-026 créé : `docs/bugs/BUG-026-zerotier-absent-du-wizard.md`
- [x] ZeroTier 1.16.1 installé sur Pi (adresse `1b6d1d7c29`)
- [x] Rejoint réseau `f3797ba7a8e6a4b5`, IP `10.115.169.147` assignée
- [x] PC autorisé sur le réseau (adresse `3374437afe`, IP `10.115.169.55`)
- [x] Wizard accessible via `http://10.115.169.147:8080/` — OK 2026-05-04
- [ ] TODO : intégrer l'installation ZeroTier dans le wizard (step SSE)

### BUG-025 — Wizard Kolibri : 3 tuiles Khan Academy EN/ES/FR — DEPLOYE 2026-05-04
- [x] Diagnostic : `khan_es` avait l'ID du canal anglais (`1ceff53605e55bef987d88e0908658c5`)
- [x] IDs corrects vérifiés via communauté Learning Equality : EN=`1ceff…`, ES=`c1f2b7…`, FR=`878ec2…`
- [x] `setup/app.py` : ajout `khan_en`, correction IDs `khan_es` et `khan_fr`
- [x] `setup/templates/index.html` : ajout tuile Khan Academy EN
- [x] Déployé sur Pi + restart `edubox-setup`
- [x] Tester le wizard — vérifier les 3 tuiles et lancer DL khan_es
- [x] Committer

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

### BUG-020 — Wizard inaccessible après redémarrage — FIXED 2026-05-04
- [x] Créer `setup/Dockerfile` (Python + Docker CLI + Compose plugin)
- [x] Ajouter service `setup` dans `docker-compose.yml`
- [x] `bootstrap.sh` : remplacer nohup par `docker compose up -d --build setup`
- [x] Déployé sur Pi — edubox-setup Up, HTTP 200
- [x] Tester après reboot Pi — OK 2026-05-04 : tous les 15 services remontés en 45s, wizard HTTP 200
- [x] Committer (890199d)

### BUG-021 — Moodle redirect localhost — FIXED 2026-05-02
- [x] `nginx/conf.d/edubox.conf` : `proxy_redirect http://localhost/moodle/`
- [x] `nginx/conf.d/edubox.conf` : double `sub_filter` localhost→$http_host (HTML + JSON-encoded)
- [x] `moodle/99-fix-wwwroot.sh` : `chmod +x` sur Pi
- [x] Purge caches Moodle
- [x] Déployé + nginx reloadé — 0 localhost URL restant (hors body CSS class)
- [x] Tester login Moodle depuis 192.168.0.147 — OK 2026-05-02
- [x] Tester portail — OK 2026-05-04 : Location→192.168.0.147 (plus localhost), HTML Moodle propre, wizard-state.json 200
- [x] Committer (890199d)

### BUG-022 — Kolibri import Khan Academy échoue — FIXED 2026-05-02
- [x] `setup/app.py` : `_wait_for_healthy("edubox-kolibri")` avant import
- [x] `setup/app.py` : meilleure gestion d'erreur import
- [x] Déployé sur Pi
- [x] Tester via wizard (recoche Khan Academy + réinstalle) — OK 2026-05-05
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
- [x] Pousser sur GitHub — fait le 2026-08-23, mais sur la branche `box-durcissement-2026-08` : le dépôt de la Box a divergé de `master` (22 commits d'écart), un push direct aurait effacé du travail. Voir BUG/note ci-dessous.
- [ ] Tester `bootstrap.sh` sur Pi vierge
- [x] Committer (890199d)

### FEAT-012 — Gutenberg ES + Migration SD 512 GB + Profils multi-box — EN COURS 2026-05-01
- [x] Migration SD : clone Win32DiskImager PC (2 lecteurs USB) + `raspi-config nonint do_expand_rootfs`
- [x] Télécharger ZIM Gutenberg ES (`gutenberg_es_all_2026-01.zim`, 1.7 Go) sur le Pi
- [x] ~~Migration SD par clone Win32DiskImager~~ — **faite autrement le 2026-08-26** :
      carte neuve + `RESTAURER-OFELIA.sh`, apres la panne de la 512 Go (BUG-038).
- [x] Télécharger ZIM Gutenberg ES — présent : `kiwix/data/gutenberg_es.zim` (1,7 Go), servi et vérifié.
- [x] `docker-compose.yml` : ajouter `gutenberg_es.zim` à la commande kiwix
- [x] `portal/index.html` : carte Gutenberg + i18n 6 langues + fix dot-wikisource
- [x] `profiles/ofelia-es/profile.env` : profil actuel encodé
- [x] `profiles/fr-box/profile.env` : profil box française (Wikipedia FR + Gutenberg FR)
- [x] `scripts/make-box.sh` : script de provisionnement par profil
- [x] `docs/specs/FEAT-012-box-profiles-gutenberg.md` : spec
- [x] `docs/specs/specs_keebee.md` v2.1
- [x] Déployer sur le Pi + test utilisateur
- [x] Committer
- [x] Déployé sur la Pi et testé par Val (plusieurs fois depuis, dernier le 2026-08-26)
- [ ] Committer

### FEAT-011 — Bind mounts + scripts install/backup/restore — EN COURS 2026-04-01
- [x] Vérifier noms des volumes Docker (préfixe `edubox_`)
- [x] Créer répertoires `/opt/edubox/data/` avec bons UIDs (999/82/33)
- [x] Mettre à jour `docker-compose.yml` (volumes nommés → bind mounts)
- [x] Migrer données : MariaDB, Moodle, Koha, Digistorm, PMB, SLiMS, Portainer
- [x] Migrer Kolibri — fait : `data/kolibri` occupe 74 Go, conteneur `healthy`, `/kolibri/` répond.
- [x] Créer `scripts/install.sh` (installation Pi neuf)
- [x] Créer `scripts/backup.sh` (backup complet BDD + appdata)
- [x] Créer `scripts/restore.sh` (restauration depuis backup)
- [x] Mettre à jour `scripts/edubox-backup.sh` (ajoute archive appdata)
- [x] Stack confirmée fonctionnelle — 14/14 conteneurs, toutes les routes répondent
- [x] ⛔ **Sans objet depuis le 2026-08-26** : la carte a été refaite de zéro,
      il n'existe plus aucun ancien volume nommé.
- [ ] Committer

### FEAT-010 — Import cours Moodle depuis Rescate_Moodle_OFELIA — RE-DONE 2026-05-05
- [x] Copie 6 fichiers .mbz sur le Pi (/tmp/)
- [x] docker cp vers container edubox-moodle
- [x] Restauration via php admin/cli/restore_backup.php --categoryid=1
- [x] 6 cours restaurés : taller_cdigital (2), tgb (3), lk (4), biblioteca_digital (5), mujer_emprende (6), tec (7)
- [x] Site name : Dockerized_Moodle → Ofelia (UPDATE mdl_course id=1)

### BUG-009 — Moodle config (CORS + password + site name) — FIXED 2026-03-30
- [x] Fix wwwroot dynamique dans config.php (CORS cross-origin)
- [x] Activation reverseproxy = true
- [x] Reset mot de passe admin (vfeJt38uKwSKZKgnEduBox!) — via script PHP (pas CLI SSH, ! = historique bash)
- [x] Fix policyagreed=1 pour le compte admin (bloquait login web)
- [x] Site name Dockerized_Moodle → Moodle (UPDATE mdl_course id=1)
- [x] Cache purgé (purge_caches.php)

### FEAT-009 — Multilingue (Moodle, Kolibri, Koha, SLiMS, PMB) + URLs portail — DONE 2026-03-30 / RE-DONE 2026-05-05
- [x] Packs langues Moodle téléchargés et installés : es, pt, it, de (Moodle 5.2 — download.moodle.org/download.php/direct/langpack/5.2/)
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
- [x] 6.2 Accès distant via ZeroTier (réseau f3797ba7a8e6a4b5, Pi IP 10.115.169.147) — installé 2026-05-04, adresse Pi 1b6d1d7c29
- [ ] 6.3 Configurer backups automatiques (systemd timer)
- [x] 6.2 Accès distant via ZeroTier (réseau f3797ba7a8e6a4b5, Pi IP 10.115.169.147)
- [x] 6.3 Configurer backups automatiques (systemd timer) — fait par FEAT-030 (`ofelia-backup.timer`, 03h00, `Persistent=true`). ⚠️ Le timer est armé mais **la clé USB est morte et non remplacée** (BUG-031) : aucune sauvegarde ne s'écrit.
- [x] 6.4 Service systemd `ofelia.service` créé et activé
- [x] 6.5 Test reboot — tout redémarre automatiquement (vérifié)
- [x] 6.6 Test coupure électrique — validé plusieurs fois. A révélé BUG-032 (la Box redémarrait vide) puis FEAT-033 (démarrage ordonné). Dernier essai le 2026-08-23 : 14/14 conteneurs revenus seuls.

### Bugfixes récents
- [x] BUG-001 Fix Koha log dir manquant (crash supervisord sur restart)
- [x] BUG-002 Fix Kiwix upstream port 8080
- [x] BUG-003 Fix Kiwix CSS/JS cassés — `--urlRootLocation=/wiki`
- [x] BUG-004 Fix Kiwix viewer mobile — iframe 100dvh
- [x] BUG-005 Fix Koha OPAC page Apache par défaut — entrypoint vérifie sites-available
- [x] BUG-006 Fix Moodle cassé multi-réseau — sub_filter `$host` dynamique
- [x] BUG-007 Fix Koha OPAC 404 après login — CGI opac-* routés vers staff au lieu d'OPAC (nginx)
- [x] 6.7 Configurer ZIP_CONTENT_PORT=8081 — options.ini + docker-compose.yml — OK 2026-05-04 (port 8081 répond 404 = serveur actif ; PhET non encore installé)

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

## ⚠️ Deux numérotations FEAT/BUG coexistent dans cet arbre

`docs/specs/` et `docs/bugs/` numérotent les features **d'EduBox / la Ofelia
Box**. Le dossier `bibliofelia/` contient un autre projet, avec sa **propre**
numérotation — et les plages se recouvrent :

| Numéro | Ici (EduBox) | Dans `bibliofelia/` |
|---|---|---|
| FEAT-030 | durcissement pour le terrain | suppression d'un compte |
| FEAT-031 | Calibre sans login | enrichissement métadonnées |
| FEAT-036 | retrait image de fond | réservations prêtes |

Ce n'est pas une erreur à corriger : `bibliofelia/` **n'est pas suivi par ce
dépôt** (0 fichier indexé), il y est déployé par copie. Mais un `grep FEAT-031`
dans l'arbre ramène les deux, et une fiche lue hors contexte induit en erreur.

**Règle :** toujours préciser le projet quand on cite un numéro. Ne jamais
attribuer un numéro EduBox en se fiant à un commentaire trouvé dans
`bibliofelia/`, ni l'inverse.

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
- [x] **Fuseau tranché par Val le 2026-08-25 : on garde `America/Caracas`.**
      Conséquence assumée : les dates BibliOfelia s'affichent avec 6 h de
      décalage tant que la Box est en Europe. C'est le fuseau du terrain.

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

### FEAT-037 — La page de démarrage sur `/boot`

- [x] Route `/boot` dans `setup/app.py`, toujours sans mot de passe
- [x] `/demarrage` conservée en redirection **302** (jamais 301 : un permanent
      se met en cache sans péremption)
- [x] Endpoint renommé : liste des routes libres et `url_for()` de la racine suivis
- [x] Fiches FEAT-033 et FEAT-034 mises à jour, BUG-036 datée
- [x] **Validé à l'écran par Val** le 2026-08-26

### BUG-037 — Deux heures affichées sans dire lesquelles

- [x] Cause écartée : les deux horloges portent le même instant (epoch identique)
- [x] Étiquette précisée : « Date et heure **de cet appareil** »
- [x] Explication sous le champ, affichée **seulement** si les décalages diffèrent
- [x] Six langues (fr, en, es, pt, it, de)
- [x] Logique rejouée hors navigateur : `-0400`, `+0530`, `+0000`, valeur vide
- [x] Gate i18n : `i18n_audit_setup.py` → 0 chaîne, code de sortie 0
- [x] **Validé à l'écran par Val** le 2026-08-26

### BUG-038 — La Box ne demarre plus : la carte SD cesse de repondre

- [x] Cause etablie : `mmc0: Card stuck being busy`, fil du noyau bloque > 120 s
- [x] Huit fausses pistes refutees, mesures a l'appui (voir la fiche)
- [x] `nofail` sur `/boot/firmware` — le mode urgence ne peut plus venir de la
- [x] Journaux Docker plafonnes (3 x 10 Mo) — ils etaient **sans limite**, 108 Mo
- [x] NTP reactive — la Box etait restee au 24 aout, sans pile d'horloge
- [x] Donnees verifiees intactes + instantane supplementaire
- [x] **Essai sur une autre carte : FAIT le 2026-08-25.** 30 Go d'E/S, **0 blocage**
      dans le même lecteur → la carte 512 Go est bien la fautive, pas la Pi.
      C'est la preuve qui fonde la demande de garantie.
- [x] **Ventilateur installé par Val le 2026-08-25** : 70,8 °C → **36,7 °C** au repos.
      ⛔ N'a PAS supprimé les calages (le défaut était la carte, pas la chaleur).

### FEAT-038 — Surveiller les blocages de la carte SD dans l'assistant

- [x] `scripts/sd-health.sh` — mesure, ecriture atomique du JSON
- [x] `ofelia-sd-health.timer` — 90 s apres le demarrage, puis toutes les 5 min,
      en priorite disque `idle` (ne pas concurrencer ce qu'on surveille)
- [x] `GET /api/sd-health` dans l'assistant, derriere le mot de passe (401 verifie)
- [x] Panneau sous celui de l'horloge : etat, compteurs 24 h / 7 j, temperature,
      sous-tension, age de la mesure **et** date de debut du journal
- [x] 15 cles x 6 langues — verifiees presentes une a une
- [x] Journaux persistants : surcharge du `Storage=volatile` impose par
      Raspberry Pi OS (`.conf.d/` prime sur `journald.conf`), plafond 200 Mo
- [x] Syntaxe JS validee (6 blocs), gate i18n a 0
- [x] **Valide a l'ecran par Val** le 2026-08-25 — commit `52e4912`
- [x] **Duree des blocages mesuree** (demande de Val) : `sd-stall-watch.py`
      observe /proc/diskstats — le noyau signale le debut d'un calage, jamais
      sa fin, la duree ne peut donc venir que de l'observation directe
- [x] Definition explicite : reprise moins dernier instant productif. Le premier
      jet raccourcissait chaque duree d'une seconde ; **les tests l'ont attrape**
- [x] `scripts/test_stall_watch.py` — 5 scenarios sur le VRAI script (entrees
      remplacees), et 0 faux positif sur 4,5 Go de charge reelle
- [x] Champ « Plus long blocage mesure » dans le panneau, 6 langues
- [x] **Validé à l'écran par Val** le 2026-08-26
- [x] `scripts/durcir-boot.sh` versionne et appele par `RESTAURER-OFELIA.sh` :
      les trois reglages de /etc (nofail, journaux persistants, plafond Docker)
      survivent desormais a une reinstallation
- [x] `ofelia-sd-health.timer` **active** par le script de restauration — il
      etait installe mais jamais demarre, la surveillance aurait ete muette
- [x] Idempotence verifiee : relance → aucun changement

### Remontage de la Box sur carte neuve — 2026-08-26

Premier passage reel de `RESTAURER-OFELIA.sh` sur une machine vierge : la case
« Tester bootstrap.sh sur Pi vierge », ouverte depuis la creation du depot, est
enfin levee. Le script fonctionne — et deux defauts serieux sont apparus, que
seul un vrai sinistre pouvait reveler.

- [x] Carte neuve, Raspberry Pi OS Lite 64-bit (Trixie), `sudo` sans mot de passe
- [x] Docker 29.7.2 + Compose v5.5.0 installes
- [x] `RESTAURER-OFELIA.sh` execute de bout en bout, sans erreur
- [x] **BUG-039** — la sauvegarde ecrasait 10 fichiers de code a jour (FEAT-033,
      037, 038, 039 perdus silencieusement). Corrige : `git checkout` apres
      extraction, versions ecrasees conservees dans `.restauration-<date>/`
- [x] **BUG-039b** — profils Wi-Fi restaures mais invisibles : `systemctl reload`
      ne relit pas les profils deposes apres coup, il faut `nmcli connection reload`
- [x] **BUG-040** — BibliOfelia en boucle de redemarrage (code 127) : les sources
      transferees depuis Windows etaient en CRLF, et un `\r` dans un shebang rend
      le script introuvable pour le noyau. 680 fichiers convertis, image rebatie
- [x] Donnees restaurees et verifiees : **953 exemplaires, 22 membres, 3 prets**
- [x] MariaDB restauree : 490 tables Moodle
- [x] `ofelia-sd-stall-watch` **active** — il etait installe mais jamais demarre
- [x] Limites memoire Docker : `cgroup_enable=memory` ajoute a `cmdline.txt`
      (elles etaient toutes ignorees, un conteneur pouvait saturer les 4 Go)
- [x] Bibliotheques hors-ligne retelechargees (12 Go de ZIM)
- [x] **Digistorm réparé** (commit `269dcfd`) : sources reclonées depuis Codeberg,
      point d'entrée renommé `server/app.js` dans la 1.2.0. Répond en HTTP 200.
- [x] **Kolibri rechargé** : Khan Academy espagnol, **30 068 / 30 069 ressources**.
      Les 228 fichiers restants sont introuvables *sur le serveur Kolibri*
      (362 erreurs 404 côté Studio) — rien à faire de plus.
- [x] **Calibre restauré depuis l'ancienne carte** — bien mieux qu'une régénération :
      **150 555 livres, 70 677 auteurs** (et non 2 835). ⛔ La régénération par
      `populate_books.py` est CASSÉE (`table books has no column named uuid`) et
      annonce « terminé » en produisant 0 livre. Voir BUG-044.
- [x] **Point d'accès activé le 2026-08-26** sur `wlan0` (`192.168.50.1`), avec Val
      devant la Box et un retour arrière automatique armé à 3 min. Priorité 100 et
      `autoconnect no` sur le profil client, pour survivre au redémarrage.
- [x] **`.gitattributes` committé dans BibliOfelia** (`2832c15`), poussé sur `main`.
      L'index y était déjà propre : aucun fichier suivi n'a été modifié.
- [x] **Fait le 2026-08-26** — retours consignés dans BUG-041, tous traités

### 2026-08-26 — retours du test de Val, valides

- [x] **BUG-041** — identifiants : `admin` / `Ofelia2026` sur les 4 applications,
      applique DANS chacune et verifie par connexion reelle. Cause de fond
      corrigee : `/api/update-credentials` n ecrivait que dans un fichier JSON
- [x] Portail : toutes les applications s affichaient « hors ligne » — il lisait
      un objet la ou `/api/status` renvoie un tableau. Val n avait signale que
      Digistorm
- [x] Bouton retour au portail dans Kiwix (Wikipedia, Wikisource, Gutenberg) et
      dans Digistorm, seule application servie hors nginx
- [x] Scan Wi-Fi de l assistant : `_wifi_client_iface()` excluait `wlan0` en dur
- [x] **FEAT-044** — page des identifiants independante de l assistant, avec sa
      propre authentification (etanche verifiee dans les deux sens). Aucun lien
      depuis l assistant, a la demande de Val
- [x] **BUG-042 RESOLU** — le dongle Wi-Fi exige un port USB **2.0 (noir)**.
      Teste sur Bruxelles : code 28 = pilote absent, **le materiel est sain**
- [x] **BUG-043** — portail lent depuis le Wi-Fi : 773 Ko d images pour 19 Ko de
      HTML (fond = photo en PNG palette !) + economie d energie active sur l AP.
      Page ramenee a 170 Ko, reglage rendu persistant
- [x] **FEAT-045** — mots de passe masques, oeil pour reveler, re-masquage a 30 s
- [x] **FEAT-046** — oeil sur les deux acces Ofelia, libelles courts, 6 langues
- [x] Route obsolete `ofelia.zitoon.com` retiree sur **Fez ET Avignon**
- [x] Point d acces `Ofelia` sur `wlan0`, priorise pour survivre au redemarrage
- [x] **Terminé le 2026-08-27** — 30 068 / 30 069 ressources, 74 Go.
- [x] **Terminé le 2026-08-27**, par restauration et non par régénération :
      150 555 livres, 6,6 Go, lus par Calibre-Web depuis `/books`.

⚠️ **Le dongle Wi-Fi a fait planter la Box deux fois** le 2026-08-26. Materiel
sain, pilote `rtw89_8852bu` fragile. Ne pas le considerer comme fiable pour un
site isole ; envisager une puce mieux supportee (RTL8188, MT7601).

⚠️ **Les contenus lourds se lancent DETACHES** (`scripts/telecharger-contenus.sh`
via `systemd-run`). Deux telechargements lances en SSH sont morts avec la
connexion, apres 218 Mo et 117 Mo.

### Infrastructure

- [x] Unités systemd versionnées dans `systemd/` et réinstallées par `RESTAURER-OFELIA.sh`
- [x] **Push GitHub** — fait le 2026-08-23 sur la branche `box-durcissement-2026-08`.
      La Box n'a aucune clé GitHub : passage par un `git bundle` puis push depuis
      le poste de Val. ⛔ **Jamais de force-push depuis la Box** — elle a 22 commits
      de retard sur `master`, ce serait effacer du travail.

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
