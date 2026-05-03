# FEAT-015 — Bibliothèque HuggingFace : livres espagnols domaine public

**Status:** DONE  
**Date:** 2026-05-01  
**Updated:** 2026-05-03

## Context

Dataset HuggingFace : `PleIAs/Spanish-PD-Books`  
Livres en espagnol dans le domaine public (Biblioteca Digital Hispanica + Internet Archive).  
L'utilisateur souhaite pouvoir rechercher et lire ces ouvrages depuis la box hors-ligne.

## Research findings (2026-05-02)

- **Format** : Parquet (colonnes : identifier, creator, title, publication_date, word_count, text)
- **Taille totale** : 52,1 Go (302 640 livres, 13,9 milliards de mots)
- **Structure** : Shards Parquet individuels (~2 000 livres par fichier)
- **API** : `huggingface_hub` — `hf_hub_download()` par shard, streaming possible
- **Calibre-web arm64** : supporté (`lscr.io/linuxserver/calibre-web:latest`, ~245 Mo)
- **Ebook conversion** : indisponible sur arm64 (x86-64 seulement) — non bloquant

## Architecture retenue : Pipeline Parquet → EPUB → Calibre-web

**Problème** : Calibre-web ne lit pas les Parquet. Une conversion intermédiaire est nécessaire.

**Option retenue** :
1. Télécharger un sous-ensemble de shards Parquet (ex: 1–3 shards = 2 000–6 000 livres, ~150–450 Mo de texte)
2. Script Python de conversion : Parquet → EPUB (via `ebooklib`) par livre
3. Calibre-web pour browse/téléchargement (arm64 OK)
4. Tuile portail `/calibre/`

**Alternative légère** (si EPUB trop lourd) : Flask minimaliste avec SQLite catalogue + affichage HTML du texte → pas de Calibre-web.

## Spec technique

### Service Calibre-web (`docker-compose.yml`)

```yaml
calibre:
  image: lscr.io/linuxserver/calibre-web:latest
  container_name: edubox-calibre
  environment:
    - PUID=1000
    - PGID=1000
    - TZ=America/Lima
  volumes:
    - /opt/edubox/data/calibre:/config
    - /opt/edubox/data/books:/books
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:8083"]
    interval: 30s
    timeout: 10s
    retries: 5
```

Nginx : `location /calibre/ { proxy_pass http://calibre:8083/; }`

### Script de population (`setup/scripts/populate_books.py`)

```python
# 1. Télécharger N shards Parquet depuis HuggingFace
# 2. Lire chaque ligne (titre, auteur, texte)
# 3. Générer EPUB avec ebooklib
# 4. Enregistrer dans /opt/edubox/data/books/
```

### Intégration wizard

- Option "Bibliothèque PD Espagnol" dans la section Libraries du wizard
- Paramètre configurable : nombre de shards (1 = ~2 000 livres, 3 = ~6 000 livres)
- Taille estimée : ~200 Mo/shard de texte + EPUBs générés

## Impact sur l'existant

- `docker-compose.yml` : nouveau service `calibre`
- `nginx/conf.d/edubox.conf` : location `/calibre/`
- `setup/app.py` : option calibre dans le wizard + fonction `_install_calibre()`
- `setup/scripts/` : script `populate_books.py` (Python, ebooklib, pyarrow)
- `portal/index.html` : tuile "Bibliothèque PD"

## Implémentation (2026-05-03)

### Fichiers créés / modifiés

- `setup/scripts/populate_books.py` : script Python, télécharge N shards via datasets-server API, génère EPUBs avec `ebooklib`, crée `metadata.db` Calibre-compatible (SQLite), reprise automatique
- `setup/requirements.txt` : ajout `pyarrow`, `ebooklib`
- `setup/Dockerfile` : install requirements + COPY scripts/
- `setup/app.py` : `_install_calibre(n_shards)`, `_configure_calibre_web()`, dirs `data/calibre` + `data/books` dans `_create_dirs()`, état `calibre` dans wizard-state.json
- `setup/templates/index.html` : section "Bibliothèque numérique" avec checkbox + champ shards
- `nginx/conf.d/ofelia-locations.inc` : `location /calibre/` avec `X-Script-Name /calibre`
- `portal/index.html` : tuile Calibre-Web + i18n 6 langues + visibilité via wizard-state
- `docker-compose.yml` : `calibre` dans `nginx-proxy.depends_on`

### Notes techniques

- **API shards** : `datasets-server.huggingface.co/parquet?dataset=PleIAs%2FSpanish-PD-Books` → URLs directes, pas besoin de `huggingface_hub`
- **Calibre library** : metadata.db SQLite + EPUBs dans structure `Author/Title (id)/`
- **Configuration Calibre-Web** : POST HTTP à `/` avec `config_calibre_dir=/books` (setup wizard)  
- **Nginx** : `proxy_pass http://edubox-calibre:8083/;` + `X-Script-Name: /calibre` + `proxy_redirect / /calibre/;`
- **Reprise** : `lccn` = identifier HuggingFace, skip si déjà dans metadata.db
- **Mode hors-ligne** : si `EDUBOX_DIR/data/parquet-import/*.parquet` existent → `--local-dir` auto (pas de téléchargement HuggingFace)
- **Mémoire setup** : limite container setup portée à 512M (pyarrow + ebooklib nécessitent ~400M par shard)
- **Crash `hf download` sur Pi** : `hf download --repo-type dataset` charge la lib `datasets` qui indexe tout le dataset (52 Go) en mémoire → OOM. Notre script évite ça via `pq.read_row_group()` un groupe à la fois.
- **Schéma metadata.db** : Calibre-Web exige `library_id` (uuid), `identifiers`, `custom_columns` + colonne `uuid` dans `books`. Tables ajoutées dans `init_calibre_db()`.
- **Dates ISO** : `pubdate` dans le dataset est un entier (ex: `1863`) ou chaîne non-ISO. Normalisé via `_to_iso_date()` avant insertion. SQLAlchemy exige des strings ISO avec timezone.
- **Auto-configuration** : `_configure_calibre_web()` fait login (`admin`/`admin123`) puis POST `/admin/dbconfig` avec `config_calibre_dir=/books`.
- **Nginx** : `proxy_pass http://edubox-calibre:8083/;` (trailing slash, sans variable) pour strip correct du préfixe `/calibre/`.

## Steps

- [x] Research format dataset + taille (Parquet, 52 Go, 302k livres)
- [x] Évaluer Calibre-web arm64 (OK, ~245 Mo)
- [x] Proposer spec technique (pipeline Parquet → EPUB → Calibre-web)
- [x] Implémenter service calibre dans docker-compose.yml (fait en FEAT-015 pre-session)
- [x] Script populate_books.py (Parquet → EPUB, pyarrow + ebooklib)
- [x] Intégrer dans le wizard (setup/app.py + index.html)
- [x] Nginx location /calibre/ + portail tuile
- [x] Mode hors-ligne : `--local-dir` dans populate_books.py + détection auto dans app.py
- [x] Fix limite mémoire setup container : 128M → 512M
- [x] Copier 3 shards sur Pi (`/opt/edubox/data/parquet-import/`) — 2 835 livres
- [x] Rebuild image setup + déployer
- [x] Tester sur Pi — livres visibles dans Calibre-Web
- [x] Fix schéma metadata.db (library_id, uuid, identifiers, custom_columns)
- [x] Fix dates ISO (pubdate entier/chaîne → _to_iso_date())
- [x] Fix nginx /calibre/ (proxy_pass trailing slash, proxy_redirect off)
- [x] Fix auto-configuration Calibre-Web (login + POST /admin/dbconfig)
- [x] Committer
