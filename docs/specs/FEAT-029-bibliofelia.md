# FEAT-029 — Intégration BibliOfelia dans le wizard Ofelia

**Statut** : DONE — validé Val 2026-05-22
**Date** : 2026-05-22
**Repo source BibliOfelia** : https://github.com/valery-blanc/BibliOfelia
**Spec côté BibliOfelia** : `BibliOfelia/docs/specs/FEAT-020-integration-keebee.md`

---

## Contexte

BibliOfelia est un logiciel Django de gestion de bibliothèque hors-ligne
développé spécifiquement pour la Ofelia Box. Il cohabite avec Koha sur la
même Box : Koha reste sur `/biblio/`, BibliOfelia est servi sur
`/bibliofelia/`. L'utilisateur peut donc choisir l'un, l'autre ou les deux
depuis le wizard.

Choix retenu (validé Val 2026-05-22) : keebee clone le dépôt GitHub
BibliOfelia au moment de l'installation et build l'image directement sur la
Pi — **même mécanisme que Digistorm**. Pas de registry, pas de buildx
multi-arch ; internet n'est requis que pendant l'installation.

---

## Solution

### Wizard (`setup/app.py` + `setup/templates/index.html`)

- Nouvelle entrée `bibliofelia` dans la liste `APPS` (badge Optionnel).
- Nouvelle carte à cocher dans `setup/templates/index.html`.
- `_prepare_bibliofelia()` : clone (ou `git pull --ff-only`) du dépôt dans
  `/opt/edubox/bibliofelia/` avant le `docker compose pull/up --build`.
- Quand l'utilisateur coche BibliOfelia, le wizard ajoute aussi
  `bibliofelia-worker` à la liste des services à démarrer.
- `_create_dirs` : création de `data/bibliofelia/data` et
  `data/bibliofelia/media` (UID hôte 1000, suffisant — Django tourne en root
  dans le conteneur).
- `_write_env` : génère et persiste `BIBLIOFELIA_SECRET_KEY` (50 chars
  url-safe, idempotent — relancer le wizard ne casse pas les sessions).
- `_report_health` : container map enrichie avec `edubox-bibliofelia` et
  `edubox-bibliofelia-worker`.

### `docker-compose.yml` — deux nouveaux services

| Service | Conteneur | Rôle |
|---|---|---|
| `bibliofelia` | `edubox-bibliofelia` | Django + gunicorn (port interne 8001) |
| `bibliofelia-worker` | `edubox-bibliofelia-worker` | django-q2 `qcluster` |

- Build `./bibliofelia` (target `prod`).
- Volumes : `/opt/edubox/data/bibliofelia/data` (SQLite),
  `/opt/edubox/data/bibliofelia/media` (uploads, couvertures),
  `bibliofelia_static` (statique collecté, lecture seule dans nginx),
  `/etc/avahi/services` (publication mDNS `_bibliofelia._tcp.` — FEAT-019
  BibliOfelia).
- Variables clés : `SECRET_KEY=${BIBLIOFELIA_SECRET_KEY}`,
  `FORCE_SCRIPT_NAME=/bibliofelia`, `SECURE_COOKIES=false` (AP WiFi en HTTP),
  `ALLOWED_HOSTS=*` (IP de la Box variable).
- `bibliofelia-worker` démarre uniquement quand `bibliofelia` est `healthy`
  (évite la course aux migrations sur SQLite).
- Limites mémoire : 384 Mo web + 192 Mo worker.

### `nginx/conf.d/ofelia-locations.inc`

- `location /bibliofelia/static/` → `alias` sur `bibliofelia_static`
  (volume Docker monté en RO dans `nginx-proxy`).
- `location /bibliofelia/media/` → `alias` sur
  `/opt/edubox/data/bibliofelia/media` (monté en RO dans `nginx-proxy`).
- `location /bibliofelia/` → `proxy_pass http://edubox-bibliofelia:8001/;`
  via `resolver 127.0.0.11` (résolution DNS dynamique : nginx démarre même
  si BibliOfelia n'est pas installé, comme pour PMB/SLiMS).
- Bouton « Portail » injecté en bas de page (sub_filter `</body>`).

### `portal/index.html`

- Nouvelle tuile BibliOfelia (couleur `green`, `href: /bibliofelia/`).
- Texte de description ajouté pour les 6 langues du portail.
- `applyWizardState` masque la tuile si l'utilisateur n'a pas coché
  BibliOfelia.

### `healthcheck/app.py`

- Nouvelle entrée `bibliofelia` (container `edubox-bibliofelia`) — apparaît
  dans le dashboard `/status/`.

### `bootstrap.sh`

- Installation système de `avahi-daemon` + `avahi-utils` (déjà présent sur
  Raspberry Pi OS par défaut, mais explicité pour les Pi reinstallés ou
  les images minimales).

---

## Cohabitation avec Koha

| App | Route nginx | Source |
|---|---|---|
| Koha (OPAC) | `/biblio/` | image Docker pré-existante |
| Koha (staff) | `/biblio-admin/` | image Docker pré-existante |
| BibliOfelia | `/bibliofelia/` | repo cloné + build sur la Pi |

Les deux sont sélectionnables indépendamment dans le wizard.

---

## Identifiants

Pas d'identifiants par défaut. Au premier accès `/bibliofelia/`, BibliOfelia
sert son propre **wizard de premier démarrage** (FEAT-015 côté BibliOfelia)
qui demande à l'utilisateur de créer le compte superadmin.

---

## Idempotence

- `_prepare_bibliofelia()` : si `.git` existe → `git pull --ff-only`.
  Sinon → `git clone --depth=1`.
- `_write_env()` : `BIBLIOFELIA_SECRET_KEY` lue depuis `.env` existant si
  présente, sinon générée (cohérent avec MariaDB et autres mots de passe).
- Côté BibliOfelia : `entrypoint.sh` fait `migrate --noinput` + seed
  conditionnel + `collectstatic --noinput` à chaque boot (FEAT-020).

---

## Impact sur la Pi existante

Aucun pour les apps déjà installées. Si BibliOfelia n'est pas coché, aucun
container BibliOfelia ne démarre, et les blocs `location /bibliofelia/`
nginx renvoient simplement 502 si on les sollicite manuellement (résolution
DNS dynamique). La tuile portail est masquée par `applyWizardState`.

---

## Mise à jour de BibliOfelia (post-installation)

`_prepare_bibliofelia()` détecte `.git` dans `/opt/edubox/bibliofelia/` pour
décider clone vs pull. Après la première installation (2026-05-22), ce
dossier était un sous-dossier du repo keebee (pas de `.git` propre). Correction
appliquée le 2026-05-23 :

```bash
cd /opt/edubox/bibliofelia
git init && git remote add origin https://github.com/valery-blanc/BibliOfelia
git fetch --depth=1 origin main
git branch -m master main && git branch --set-upstream-to=origin/main main
git reset --hard origin/main
```

Désormais `/opt/edubox/bibliofelia/` est un repo git autonome tracking
`origin/main`. Les futures mises à jour se font via :
- Re-lancement du wizard (coche BibliOfelia → `_prepare_bibliofelia()` fait `git pull --ff-only`)
- Ou manuellement : `git -C /opt/edubox/bibliofelia pull --ff-only && docker compose -f /opt/edubox/docker-compose.yml build bibliofelia && docker compose -f /opt/edubox/docker-compose.yml up -d bibliofelia`

**Pour les nouvelles Pi** : `_prepare_bibliofelia()` fonctionne tel quel (dossier absent → git clone).
**Règle** : ne jamais committer de fichiers BibliOfelia dans le repo keebee.
