# FEAT-030 — Durcissement de la Box pour déploiement de terrain

**Statut :** EN TEST (déployé sur la Box, en attente de validation Val)
**Date :** 2026-08-21
**Contexte :** départ de la Box sur site (Canaima) le jour même.

---

## 1. Déclencheur

Après un débranchement puis rebranchement de l'alimentation, la page
d'accueil répondait mais **toutes les applications renvoyaient
« 502 Bad Gateway »** pendant environ 15 minutes.

### Diagnostic

| Mesure | Valeur au moment de l'incident |
|---|---|
| Charge moyenne | 16,8 (sur 4 cœurs) |
| Temps CPU en attente d'E/S | **89,7 %** |
| Débit disque | ~50 Mo/s en lecture continue |
| Mémoire | 1,2 Go / 4 Go — non saturée |
| Sous-tension | aucune (`throttled=0x0`) |

Cause racine : les **17 conteneurs démarrent simultanément** (tous en
`restart: unless-stopped`, aucune orchestration) et saturent la carte SD.
Nginx démarre vite et sert la page d'accueil statique, mais les
applications derrière le proxy ne répondent pas encore → 502.

Le noyau a aussi émis pendant cette fenêtre :

```
I/O error, dev mmcblk0, sector 4723976 op 0x0:(READ)
mmc0: Card stuck being busy! __mmc_poll_for_busy      × 5
INFO: task kworker/2:1:67 blocked for more than 120 seconds
```

La carte étant neuve et de bonne qualité, ces blocages sont interprétés
comme une **saturation** sous E/S concurrentes massives, non comme une
défaillance matérielle. Aucune erreur n'est réapparue une fois la charge
retombée. Pas d'historique disponible pour comparer : `journald` est en
mode volatile, seul le boot courant est conservé.

**Les données n'ont pas été menacées** : ext4 est journalisé, SQLite est en
mode WAL, MariaDB en InnoDB — les trois survivent à une coupure par
conception, et la récupération automatique a fonctionné. Le problème
n'était pas la corruption mais l'indisponibilité.

---

## 2. Sauvegarde sur clé USB

### Support

Clé Kingston DataTraveler 3.0 de 32 Go, formatée **ext4** (label
`OFELIA_BACKUP`), montée sur `/mnt/backup` via `/etc/fstab` par UUID :

```
UUID=f274cf1f-…  /mnt/backup  ext4  defaults,noatime,nofail,x-systemd.device-timeout=10  0  2
```

`nofail` est indispensable : sans lui, une clé absente ou retirée
empêcherait la Box de démarrer.

ext4 plutôt qu'exFAT/FAT32 : le scénario qu'on couvre est précisément la
coupure de courant, or FAT se corrompt facilement en écriture interrompue.

### Contenu (`scripts/backup-usb.sh`)

| Élément | Méthode |
|---|---|
| Base BibliOfelia | API `sqlite3.backup()` — **obligatoire** en mode WAL, une copie de fichier serait incohérente |
| Bases MariaDB | `mariadb-dump --all-databases --single-transaction` |
| Médias BibliOfelia | archive tar |
| Configuration | `docker-compose.yml`, `.env`, `nginx/`, `portal/`, `setup/`, certificats |
| `MANIFEST.txt` | inventaire + procédure de restauration |

**Volontairement exclus** : les bibliothèques hors-ligne (12 Go de ZIM
Kiwix, canaux Kolibri). Contenu statique et public : avec une connexion à
20 Mo/s, le retéléchargement est plus rapide qu'une restauration, et la clé
reste légère. Leur **liste** est enregistrée dans `MANIFEST.txt`.

Taille réelle d'une sauvegarde complète : **17 Mo**. Rotation sur 14 jours.

### Automatisation

`ofelia-backup.timer` — tous les jours à 03h00, `Persistent=true` (rattrape
si la Box était éteinte). Le service tourne en `IOSchedulingClass=idle` et
`Nice=10` : sur une carte SD saturée, c'est ce qui évite qu'une sauvegarde
rende la Box inutilisable.

### Décision de sécurité : pas de clé privée ZeroTier sur la clé

Une première version sauvegardait `identity.secret` pour que la Box
retrouve automatiquement son adresse ZeroTier après réinstallation, sans
autorisation manuelle.

**C'était une faille.** L'identité ZeroTier est une clé privée dont dérive
l'adresse du nœud. Quiconque détient ce fichier peut démarrer `zerotier-one`
sur sa propre machine, être reconnu par le contrôleur comme un membre déjà
autorisé, et atteindre **toutes les autres machines du réseau** (les règles
ZeroTier par défaut autorisent tout entre membres). Sur une clé USB de
terrain — un support amovible — cela revient à distribuer un laissez-passer.

Seul l'**identifiant de réseau** (non sensible) est désormais enregistré.
Contrepartie assumée : après réinstallation, le nouveau nœud doit être
autorisé une fois dans ZeroTier Central.

> Le fichier a existé ~30 min sur la clé le 2026-08-21 avant purge. La clé
> n'a pas quitté les locaux. Pour une garantie dure, révoquer le nœud
> `1b6d1d7c29`.

---

## 3. Reprise après sinistre — `RESTAURER-OFELIA.sh`

Script autonome à la racine de la clé. Scénario couvert : carte SD morte,
Raspbian réinstallée, Box sur internet, clé branchée.

1. Installe Docker
2. Installe ZeroTier et rejoint le réseau enregistré — **en premier**, car
   sans accès distant tout le reste devrait se faire sur place
3. Clone le dépôt et restaure la configuration (`.env`, certificats)
4. Restaure la base et les médias BibliOfelia
5. Démarre **uniquement le portail d'administration** (port 8080)

La suite se fait à distance depuis ce portail. Si le nœud ZeroTier doit
être autorisé, le script affiche l'URL exacte et l'identifiant du nœud.

---

## 4. Portail d'administration sécurisé (port 8080)

### Problème

Le conteneur `edubox-setup` monte `/var/run/docker.sock`, `/opt/edubox` en
écriture, `/run/dbus`, et dispose de `NET_ADMIN` — le tout exposé sur
`0.0.0.0:8080` **sans aucune authentification**.

Pire : `portal/credentials.html` et `credentials-data.json` étaient servis
par nginx sur le port 80, exposant les mots de passe de Moodle, Kolibri,
Koha, PMB, SLiMS, MariaDB et Calibre à **tout usager du réseau**.

### Correctif

- Mot de passe sur l'intégralité du portail (`before_request`), lu depuis
  `OFELIA_ADMIN_PASSWORD` dans `.env`
- Clé de session persistée dans `.admin-session-key` — sinon chaque
  redémarrage déconnecterait tout le monde
- Comparaison par `hmac.compare_digest`
- Freinage progressif : 2 essais gratuits, puis attente doublante plafonnée
  à 5 min, par IP
- Les routes `/api/*` renvoient **401 JSON** plutôt qu'une redirection
- Page `/login` aux couleurs Ofelia
- `credentials.html` déplacé dans le portail admin ; l'accès public
  redirige (302) vers `:8080/credentials`, et `credentials-data.json`
  renvoie 404

`wizard-state.json` reste servi publiquement : le portail en a besoin. Le
blocage cible les deux fichiers sensibles, pas la règle générique.

### Bouton d'extinction

`POST /api/shutdown` (authentifié) :

1. `docker stop -t 20` sur tous les conteneurs **sauf `edubox-setup`** —
   s'arrêter soi-même tuerait le thread avant l'extinction
2. `PowerOff` via D-Bus `org.freedesktop.login1`

D-Bus fonctionne sans privilège supplémentaire : `/run/dbus` est déjà monté
et le conteneur tourne en root (`CanPowerOff` → `yes`).

L'interface affiche une confirmation, rappelle comment rallumer, et ignore
l'erreur réseau qui suit l'extinction (normale, ne doit pas alarmer).

---

## 5. Réduction du temps de démarrage

### Désinstallation de Koha, PMB et SLiMS

Trois logiciels de gestion de bibliothèque redondants avec BibliOfelia,
retirés du `docker-compose.yml`, des routes nginx, du portail et du
catalogue de l'assistant. **Données et bases conservées** (sauvegardées),
supprimables plus tard.

### Nginx démarre en premier

`nginx-proxy` avait un `depends_on` sur **8 applications** : il attendait
tout le monde avant de démarrer, alors qu'il devrait être le premier debout
pour afficher une page d'attente. Les 5 dépendances restantes ont été
retirées.

### Page d'attente au lieu du 502

`error_page 502 503 504 @ofelia_starting` → `portal/starting.html`,
rafraîchissement automatique toutes les 15 s. L'usager lit « Cette
application démarre » au lieu d'un « Bad Gateway » qu'il interprète comme
une panne.

> **Choix délibéré :** convertir les upstreams nginx en résolution
> dynamique (`resolver` + `set` + `proxy_pass $var`) aurait permis à nginx
> de démarrer sans aucune application présente. Écarté : avec une variable,
> nginx ne réécrit plus l'URI de la même façon, ce qui change le routage de
> chaque application. Trop risqué la veille d'un départ pour un gain
> marginal une fois les `depends_on` retirés.

---

## 6. Correction Kiwix

`command: --urlRootLocation=/wiki wikipedia_es.zim` ne servait qu'**un**
ZIM sur les trois présents. Les tuiles « Wikisource » et « Gutenberg » du
portail pointaient dans le vide, alors que 2,5 Go de contenu étaient sur le
disque. Corrigé :

```yaml
command: --urlRootLocation=/wiki wikipedia_es.zim wikisource_es.zim gutenberg_es.zim
```

---

## 7. Points laissés ouverts

- **Étalement du démarrage par vagues** — non implémenté. À mesurer après
  la désinstallation des trois applications avant d'ajouter de la
  mécanique (`restart: no` + service systemd ordonné + surveillance).
- **Onduleur** — seul moyen d'éliminer vraiment le risque de coupure. Une
  batterie USB avec passthrough suffit pour une Pi.
- **`journald` persistant** — sans historique, impossible de savoir si les
  blocages de carte SD se reproduisent.
- **Résidu `ofelia.zitoon.com`** dans `BIBLIOFELIA_CSRF_TRUSTED_ORIGINS`
  (domaine mort). Sans effet, à nettoyer.
- **Healthcheck Calibre cassé** — appelle `wget`, absent de l'image ;
  le conteneur est marqué `unhealthy` alors qu'il répond en 4 ms.

---

## Fichiers touchés

```
docker-compose.yml                       services, depends_on, kiwix, env
.env                                     OFELIA_ADMIN_PASSWORD
nginx/conf.d/edubox.conf                 upstreams Koha, vhost biblio
nginx/conf.d/ofelia-locations.inc        routes retirées, page d'attente, identifiants
portal/index.html                        tuiles, lien identifiants
portal/starting.html                     NOUVEAU
setup/app.py                             authentification, extinction, identifiants
setup/templates/login.html               NOUVEAU
setup/templates/credentials.html         NOUVEAU (déplacé du portail public)
setup/templates/index.html               barre d'extinction
scripts/backup-usb.sh                    NOUVEAU
/etc/systemd/system/ofelia-backup.*      NOUVEAU (hors dépôt)
/etc/fstab                               montage de la clé (hors dépôt)
<clé USB>/RESTAURER-OFELIA.sh            NOUVEAU (hors dépôt)
```

Chaque fichier modifié a une copie `.bak-<horodatage>` sur la Box.
