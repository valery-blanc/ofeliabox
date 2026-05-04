# Spec v2 — Pipeline parquet → bibliothèque Calibre enrichie
<!-- Statut : DONE 2026-05-04 — voir aussi calibre-enrichment-spec-v2-bne-patch.md -->
<!-- Implémentation : setup/scripts/calibre_enrich.py -->

## 1. Changements vs v1

L'enrichissement n'écrit **plus** dans une bibliothèque Calibre existante via `calibredb`.
Il s'insère **entre** l'extraction des EPUBs et l'import dans Calibre. Toute la chaîne
produit son output dans un répertoire de staging et une SQLite manifest. L'import
Calibre devient un one-shot final.

```
parquet shards            staging/                   Calibre library
─────────────             ────────                   ───────────────
shard_00.parquet ──┐                                       │
shard_01.parquet ──┤                                       │
       ...         ├──▶ extract ──▶ enrich ──▶ bake ──▶ import
shard_NN.parquet ──┘     │            │          │         │
                         ▼            ▼          ▼         ▼
                    manifest.db  +covers/  +OPF sidecars  done
                    + EPUBs           + manifest        (ou EPUBs
                                       enrichi          embedded)
```

## 2. Notes terminologiques sur Calibre

- **"category"** n'est pas un champ. Implémenté ici comme custom column `#category`
  multi-valeur, marquée `is-category=True` pour apparaître dans le Tag Browser.
- **"shelf"** n'existe pas en Calibre. Implémenté comme custom column `#shelf` mono,
  également category. Reste mappable trivialement sur les Shelves Calibre-Web ensuite.
- Les deux sont créés sur la bibliothèque vide juste avant l'import.

## 3. Layout du staging

Une arborescence par livre, identifiée par un slug stable (l'`identifier` du parquet
si dispo, sinon un hash) :

```
staging/
├── manifest.db
├── books/
│   ├── bdh0000123456/
│   │   ├── book.epub
│   │   ├── cover.jpg          (optionnel, présent si trouvé)
│   │   └── metadata.opf       (généré en phase bake)
│   ├── bdh0000123457/
│   │   ├── book.epub
│   │   └── metadata.opf
│   └── ...
└── logs/
    └── enrich.log
```

Calibre, au moment du `calibredb add --recurse staging/books`, lit automatiquement
les `metadata.opf` et `cover.jpg` sidecar à côté de chaque EPUB.

## 4. Manifest SQLite (source de vérité)

```sql
-- Métadonnées issues du parquet (extract phase)
CREATE TABLE books (
  slug              TEXT PRIMARY KEY,         -- = identifier parquet ou hash
  parquet_shard     TEXT NOT NULL,
  parquet_row       INTEGER NOT NULL,
  ia_identifier     TEXT,
  bdh_identifier    TEXT,
  title             TEXT,
  creator           TEXT,
  language          TEXT,
  publication_date  TEXT,
  word_count        INTEGER,
  rights            TEXT,
  epub_path         TEXT NOT NULL,
  extracted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Une ligne par source consultée pour un livre (enrich phase)
CREATE TABLE source_data (
  slug      TEXT NOT NULL,
  source    TEXT NOT NULL,        -- ia | ol | wd | bne | gb
  status    TEXT NOT NULL,        -- ok | not_found | error
  payload   TEXT,                 -- JSON brut de la réponse API
  error     TEXT,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (slug, source)
);

-- Métadonnées finales fusionnées (bake phase)
CREATE TABLE enriched (
  slug          TEXT PRIMARY KEY,
  tags          TEXT,             -- JSON array
  series        TEXT,
  series_index  REAL,
  comments      TEXT,
  category      TEXT,             -- JSON array (multi)
  shelf         TEXT,
  cover_path    TEXT,             -- relatif à staging/
  baked_at      TIMESTAMP
);

CREATE TABLE state (
  slug    TEXT PRIMARY KEY,
  phase   TEXT NOT NULL,          -- extracted | enriched | baked | imported
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMP
);

CREATE INDEX idx_state_phase ON state(phase);
```

Le manifest est **rejouable** : chaque phase ne traite que les livres dans la phase
précédente. Crash, kill -9, reprise propre.

## 5. CLI

```
calibre-enrich extract \
    --parquet-dir /path/to/shards \
    --staging /path/to/staging \
    [--limit N]                  # utile pour tests

calibre-enrich enrich \
    --staging /path/to/staging \
    --workers 8 \
    --sources ia,ol,wd,bne \
    [--retry-failed]

calibre-enrich bake \
    --staging /path/to/staging \
    [--embed]                    # appelle ebook-meta pour écrire dans l'EPUB

calibre-enrich import \
    --staging /path/to/staging \
    --library /path/to/calibre/library \
    [--init]                     # crée la lib + custom columns si absente

calibre-enrich report
    --staging /path/to/staging
```

## 6. Détail des phases

### 6.1 `extract`
Pour chaque shard parquet :
- Itérer sur les rows
- Calculer le `slug` = `ia_identifier` si présent et bien formé, sinon
  `sha256(title|creator|publication_date)[:16]`
- Créer `staging/books/{slug}/`
- Générer `book.epub` à partir de la colonne `text` (avec ebooklib)
- Injecter dès la création les metadatas dispo : `dc:title`, `dc:creator`,
  `dc:language`, `dc:date`, `dc:identifier` (= ia_identifier ou bdh_identifier)
- Insert dans `books` + `state.phase = 'extracted'`

### 6.2 `enrich`
Pour chaque livre `state.phase = 'extracted'`, lancer en parallèle :

1. **Internet Archive** si `ia_identifier` :
   - `GET https://archive.org/metadata/{id}` → `source_data(source='ia')`
   - HEAD `https://archive.org/services/img/{id}` → si OK et taille > 10 KB,
     télécharger vers `staging/books/{slug}/cover.jpg`
2. **Open Library** :
   - `GET /search.json?title=...&author=...&limit=5`
   - Score de similarité (rapidfuzz) titre+auteur ≥ 0.85 → meilleur match
   - GET de la work, récupérer `subjects`, `description`, `covers`
   - Cover fallback si pas de cover IA : `covers.openlibrary.org/b/id/{cover_id}-L.jpg`
3. **Wikidata** SPARQL (uniquement si OL ou IA a renvoyé un `wikidata_id`) :
   ```sparql
   SELECT ?genre ?genreLabel ?series ?seriesLabel ?seriesPos ?abstract
   WHERE { ... P136 ... P179 ... }
   ```
   Batch par 50 livres avec `VALUES`.
4. **BNE** SRU si `language=es` et IA+OL ont échoué pour les subjects.

Validation cover obligatoire avant download :
- `width >= 200 && height >= 300`
- sha256 pas dans la blocklist (placeholder OL connu : ajouter au fur et à mesure)
- format JPEG/PNG (pas SVG, pas placeholder vectoriel)

État final : `state.phase = 'enriched'` ou `state.last_error` rempli.

### 6.3 `bake`
Pour chaque livre `state.phase = 'enriched'` :
1. Charger toutes les `source_data` du livre
2. Fusion (cf. règles section 7)
3. Calcul `category` (heuristique section 8) et `shelf` (section 9)
4. Insert dans `enriched`
5. Générer `staging/books/{slug}/metadata.opf` :
   ```xml
   <package version="2.0" xmlns="http://www.idpf.org/2007/opf">
     <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
               xmlns:opf="http://www.idpf.org/2007/opf">
       <dc:title>...</dc:title>
       <dc:creator opf:role="aut">...</dc:creator>
       <dc:language>es</dc:language>
       <dc:date>1885</dc:date>
       <dc:identifier opf:scheme="IA">bdh0000123456</dc:identifier>
       <dc:description>...</dc:description>
       <dc:subject>Roman</dc:subject>          <!-- tags + category -->
       <dc:subject>Realismo</dc:subject>
       <meta name="calibre:series" content="Episodios Nacionales"/>
       <meta name="calibre:series_index" content="3"/>
       <meta name="calibre:user_metadata:#category"
             content='{"datatype":"text","is_multiple":{...},"#value#":["Roman"]}'/>
       <meta name="calibre:user_metadata:#shelf"
             content='{"datatype":"text","#value#":"es-19e-Roman"}'/>
     </metadata>
     <guide>
       <reference type="cover" href="cover.jpg"/>
     </guide>
   </package>
   ```
   (les meta `calibre:user_metadata:*` sont la convention pour transporter les
   custom columns dans un OPF — vérifier le format exact dans la doc Calibre)
6. Si `--embed` : `ebook-meta book.epub --from-opf=metadata.opf --cover=cover.jpg`
7. `state.phase = 'baked'`

### 6.4 `import`
1. Si `--init` et la lib n'existe pas : créer la lib vide
   ```bash
   calibredb list -l /path/to/library  # crée si absent
   calibredb add_custom_column --is-multiple category "Catégorie" text
   calibredb add_custom_column shelf "Étagère" text
   ```
   (note : `--is-multiple` pour category, le séparateur par défaut Calibre est `,`)
2. `calibredb add --recurse --library-path /path/to/library staging/books/`
3. Calibre lit les `metadata.opf` sidecar et applique tags / series / comments / cover
4. **Pour les custom columns**, l'OPF sidecar ne suffit pas toujours selon la version
   de Calibre. Plan B : après l'import, lire l'`enriched` table et faire un batch
   `calibredb set_custom` (parallélisable, mais nécessite l'ID Calibre — récupérable
   via `calibredb list --search "identifier:IA:bdh0000123456" --fields id --for-machine`)
5. `state.phase = 'imported'`

## 7. Règles de fusion

```python
tags = (
    normalize(ia.subject or [])
    + normalize(ol.subjects or [])
    + normalize(bne.tema or [])
)
tags = dedupe_accents_insensitive(tags)
tags = remove_blacklist(tags, BLACKLIST)  # "Public domain", "Spanish literature"...
tags = remove_too_generic(tags)            # tags qui apparaissent sur > 50% du corpus
tags = limit(tags, 12)

series, series_index = first_non_null(
    (wd.series, wd.series_position),
    (ol.series, ol.series_index),
)

comments = first_non_null(
    wd.wikipedia_abstract,
    ol.description,
    ia.description,
)

cover_path = (
    cover_from_ia if ia_cover_valid
    else cover_from_ol if ol_cover_valid
    else None
)
```

## 8. Heuristique `category`

Mapping ordonné, premier match gagne (ou tous les matches si on garde le multi),
appliqué sur tags fusionnés. Insensible à la casse et aux accents.

| Catégorie | Patterns FR/EN/ES |
|---|---|
| Roman | novel, novela, fiction, ficción |
| Poésie | poetry, poesía, poemas, verse, lírica |
| Théâtre | drama, plays, teatro, comedia, tragedia, zarzuela |
| Nouvelles | short stories, cuentos, relatos, novelas cortas |
| Essai | essays, ensayos, filosofía, philosophy |
| Histoire | history, historia, crónica, chronicle |
| Religion | religion, religión, teología, sermons, sermones, devocional |
| Biographie | biography, biografía, memoirs, memorias, autobiografía |
| Voyage | travel, viajes, exploration, expedición |
| Sciences | science, ciencia, matemáticas, física, química, naturalista |
| Droit | law, derecho, jurisprudencia, legislación |
| Art | art, arte, pintura, música, music |
| Linguistique | linguistics, lingüística, gramática, diccionario |
| Non classé | (fallback si rien ne matche) |

Stockée dans un fichier `classify.yml` éditable sans toucher au code.

## 9. Calcul `shelf`

```python
century = compute_century(publication_date)   # "19e", "18e", "sd"
primary_category = category[0] if category else "Divers"
shelf = f"{language}-{century}-{primary_category}"
# ex: "es-19e-Roman", "es-18e-Théâtre", "es-sd-Divers"
```

## 10. Rate limits & robustesse

| Source | Limite | Stratégie |
|---|---|---|
| Internet Archive | 30 req/s | Token bucket asyncio |
| Open Library | 100 req/min | Token bucket + retry-after |
| Wikidata SPARQL | 5 req/s | Batches de 50 via VALUES |
| BNE SRU | 2 req/s | Simple sleep |
| Google Books | 1000/jour (free) | Quota local journalier |

Retries via tenacity : exponential backoff, max 5 tentatives, ne pas réessayer sur 404.

## 11. Code structure

```
calibre_enrich/
├── pyproject.toml
├── classify.yml                  # mapping category, blacklist tags
├── README.md
├── src/calibre_enrich/
│   ├── __main__.py
│   ├── cli.py                    # typer
│   ├── config.py
│   ├── manifest.py               # wrappers SQLite (aiosqlite)
│   ├── ratelimit.py
│   ├── extract.py                # parquet → EPUB + manifest
│   ├── enrich.py                 # orchestrateur phase enrich
│   ├── bake.py                   # fusion + OPF + custom columns
│   ├── importer.py               # appels calibredb
│   ├── covers.py                 # download + validation
│   ├── classify.py
│   ├── merge.py
│   ├── opf.py                    # génération OPF
│   └── sources/
│       ├── base.py
│       ├── internet_archive.py
│       ├── open_library.py
│       ├── wikidata.py
│       ├── bne.py
│       └── google_books.py
└── tests/
    ├── fixtures/
    ├── test_classify.py
    ├── test_merge.py
    ├── test_opf.py
    └── test_sources/
```

## 12. Dépendances

`httpx[http2]`, `aiosqlite`, `typer`, `structlog`, `tenacity`, `rapidfuzz`,
`Pillow`, `lxml`, `pyarrow`, `ebooklib`, `pyyaml`, `vcrpy` (dev), `pytest` (dev),
`pytest-asyncio` (dev).

Calibre doit être installé séparément (`apt`/`brew`/`choco`) pour `calibredb` et
`ebook-meta`.

## 13. Validation et tests

- Tests unitaires de chaque source avec **vcrpy** (cassettes HTTP figées sur des
  livres connus : Don Quijote, Fortunata y Jacinta, Rimas de Bécquer, Pepita Jiménez,
  Episodios Nacionales)
- Test d'intégration : sample de 10 livres → extract + enrich + bake + import dans
  une lib temp → vérifier via `calibredb list` que tags/series/cover/#category/#shelf
  sont bien renseignés
- `test_classify.py` : table de cas (subjects in → category out)
- `test_opf.py` : OPF généré relisable par `ebook-meta`

## 14. Critères d'acceptation

Sur un sample de 1 000 livres tirés aléatoirement :
- ≥ 70 % avec ≥ 3 tags pertinents
- ≥ 60 % avec une cover réelle (pas placeholder)
- 100 % avec une `#category` (au pire "Non classé") et un `#shelf`
- 100 % importés sans erreur dans Calibre
- Idempotence : relancer chaque phase = no-op si déjà faite
- Reprise après kill -9 propre

## 15. Hors scope

- Génération AI de résumé pour les œuvres sans description
- ISBN (la plupart des œuvres sont pré-1970)
- Mises à jour incrémentales (pour l'instant : pipeline rejouable, pas update-on-change)
- UI graphique
