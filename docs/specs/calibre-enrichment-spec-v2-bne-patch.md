# Patch — Stratégie BNE-pivot

À appliquer **par-dessus** `calibre-enrichment-spec-v2.md`. Remplace les sections
indiquées et ajoute les nouvelles.

## Contexte de ce patch

Le dataset `PleIAs/Spanish-PD-Books` utilise comme `identifier` un identifiant
**BDH** (Biblioteca Digital Hispánica) ou **catálogo BNE**. Cet identifiant n'est
pas directement utilisable comme clé de recherche sur Internet Archive ou
Open Library, MAIS la BNE expose des services machine très complets qui permettent
de l'utiliser comme **point de pivot** vers les autres bases.

## Section 6.2 (enrich) — REMPLACER l'ordre des sources

L'ordre devient :

### 1. Pré-flight : déterminer le type d'ID

Le `identifier` du parquet peut être :
- Un ID BDH (commence souvent par `bdh` ou est un numéro pur, URL `bdh-rd.bne.es/viewer.vm?id={id}`)
- Un ID catálogo BNE (commence par `XX` ou `bimo`/`bdh`, URL `datos.bne.es/resource/{id}`)
- Un ID Internet Archive (alphanumérique, URL `archive.org/details/{id}`)

Sniffer un échantillon des 100 premiers IDs en phase `extract` pour confirmer le
format dominant. Stocker dans `books.id_type` (`bdh|bne_cat|ia|unknown`).

### 2. Source primaire : datos.bne.es

Pour tout ID BDH ou BNE catalog :

```python
# Tentative 1 : URI canonique
GET http://datos.bne.es/resource/{id}
Accept: application/ld+json

# Tentative 2 : si 404, recherche par identifiant alternatif
GET http://datos.bne.es/find?s={id}
```

Extraire de la réponse JSON-LD :
- `dc:title`, `dc:creator`, `dc:date`, `dc:language`
- `dc:subject` (LCSH-es) → tags
- `bne:tema` / `bne:OP4002` → tags additionnels en espagnol
- `bne:tgfbne` (genre/forma BNE) → mapping direct vers `category`
- `owl:sameAs` → liste de QIDs Wikidata, VIAF, GND, LoC, data.bnf.fr

Stocker la réponse complète dans `source_data(source='bne')`.

### 3. Bridging : extraire les IDs externes

Parser `owl:sameAs` pour récupérer :
- `viaf_id` (URL `viaf.org/viaf/{id}`)
- `wikidata_qid` (URL `wikidata.org/entity/{Q...}`)
- `loc_id` (URL `id.loc.gov/...`)
- `bnf_id` (URL `data.bnf.fr/...`)

Stocker dans une nouvelle table :

```sql
CREATE TABLE bridges (
  slug         TEXT PRIMARY KEY,
  viaf_id      TEXT,
  wikidata_qid TEXT,
  loc_id       TEXT,
  bnf_id       TEXT,
  ol_olid      TEXT,
  ia_id        TEXT
);
```

### 4. Wikidata (avec QID résolu, batch SPARQL)

Plus efficace qu'avant : on a déjà le QID, donc plus de matching fuzzy. Batch de 50
QIDs par requête SPARQL `VALUES`.

```sparql
SELECT ?work ?genreLabel ?seriesLabel ?seriesPos ?olid ?abstract WHERE {
  VALUES ?work { wd:Q123 wd:Q456 ... }
  OPTIONAL { ?work wdt:P136 ?genre. }
  OPTIONAL { ?work wdt:P179 ?series. ?work wdt:P1545 ?seriesPos. }
  OPTIONAL { ?work wdt:P648 ?olid. }
  OPTIONAL {
    ?article schema:about ?work; schema:isPartOf <https://es.wikipedia.org/>.
    ?article schema:description ?abstract.
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
```

Si pas de QID via sameAs BNE, fallback : recherche Wikidata par P950 (BNE ID) :

```sparql
SELECT ?work WHERE { ?work wdt:P950 "{bne_id}". }
```

### 5. Open Library (uniquement si OLID présent dans Wikidata, ou fallback titre+auteur)

Si on a un `ol_olid` via Wikidata P648, GET direct :
`GET https://openlibrary.org/works/{olid}.json`

Sinon, recherche par titre+auteur comme avant.

### 6. Internet Archive (uniquement si livre connu IA et cover BNE absente/invalide)

Si BDH n'a pas pu fournir de cover (rare mais possible pour livres non-numérisés
en interne), tenter IA via le titre+auteur. Ne pas faire systématiquement — ça
fait juste du bruit pour rien.

## Section 7 (fusion) — REMPLACER les priorités

Les priorités changent :

```python
tags = (
    normalize(bne.subjects + bne.tema)        # primaire, en espagnol
    + normalize(wd.genres)                     # complément normalisé
    + normalize(ol.subjects or [])             # fallback
)
tags = filter_blacklist_and_generic(tags)
tags = limit(tags, 12)

# Genre BNE = mapping direct vers category sans heuristique
category = (
    map_tgfbne_to_category(bne.tgfbne)         # ex: "Novela" → "Roman"
    or heuristic_classify(tags)                 # fallback
    or "Non classé"
)

series, series_index = first_non_null(
    (wd.series_label, wd.series_position),
    (ol.series, ol.series_index),
)

comments = first_non_null(
    wd.wikipedia_es_abstract,
    wd.wikipedia_en_abstract,
    bne.description,
    ol.description,
)
```

## Nouvelle section : Cover via BDH

BDH expose ses pages numérisées via un viewer. La **page 1 est presque toujours la
page de titre ou la couverture historique** — c'est exactement la "vraie" image
qu'on veut.

Deux URL patterns à tester (BDH a évolué) :

```
# Pattern 1 : viewer paginé
https://bdh-rd.bne.es/viewer.vm?id={bdh_id}&page=1

# Pattern 2 : preview thumbnail direct (à confirmer en live)
https://bdh-rd.bne.es/preview/{bdh_id}/1.jpg
```

**Validation** : la première page peut être une page de garde blanche, un ex-libris,
un tampon BNE… Heuristique :
- Refuser si l'image fait moins de 50 KB (probablement vide/blanche)
- Refuser si > 95% de pixels blancs (PIL `getextrema()`)
- Si refus, essayer page 2, puis page 3 (max 3 tentatives)

Si BDH ne donne rien d'exploitable, **ne pas générer de cover** plutôt que mettre
un placeholder. Calibre affichera sa cover par défaut, c'est honnête.

## Nouvelle section : Stratégie bulk vs HTTP

300 000 requêtes HTTP vers `datos.bne.es` même rate-limitées prendront des jours.
Alternative recommandée :

1. **Télécharger le dump BNElab complet** depuis datos.gob.es (le set "BDH complet"
   contient les métadonnées de toute la BDH, format RDF/XML ou Turtle, ~quelques GB)
2. Charger dans une triple-store locale (**Apache Jena Fuseki** ou **Oxigraph** —
   Oxigraph est en Rust, plus simple à déployer, ~5 min d'install)
3. Faire les SPARQL en local, ZÉRO latence réseau
4. N'utiliser HTTP que pour Wikidata (qui a son propre endpoint optimisé) et les
   covers BDH (qui sont des fichiers binaires, pas dans le RDF)

Cette stratégie change la phase `enrich` :

```
calibre-enrich load-bne-dump --dump /path/to/bne.ttl --store ./oxigraph_data
calibre-enrich enrich --bne-sparql http://localhost:7878/query
```

Estimation : avec dump local, 300k livres enrichis en quelques heures au lieu de
plusieurs jours.

## Nouvelle section : Mapping `tgfbne` → category

La BNE a un thésaurus normalisé de genres/formes (`tgfbne`).
<https://catalogo.bne.es/discovery/authsearch?vid=34BNE_INST:CATALOGO> permet de
récupérer la liste complète. Mapping recommandé (à compléter en consultant le
thésaurus pour les œuvres réelles du corpus) :

| tgfbne | category |
|---|---|
| Novelas | Roman |
| Novela histórica | Roman |
| Cuentos | Nouvelles |
| Poesía | Poésie |
| Poesía lírica | Poésie |
| Teatro | Théâtre |
| Comedias | Théâtre |
| Tragedias | Théâtre |
| Zarzuelas | Théâtre |
| Ensayos | Essai |
| Discursos | Essai |
| Sermones | Religion |
| Tratados religiosos | Religion |
| Crónicas | Histoire |
| Historia | Histoire |
| Biografías | Biographie |
| Memorias | Biographie |
| Libros de viajes | Voyage |
| Diccionarios | Linguistique |
| Gramáticas | Linguistique |
| Tratados científicos | Sciences |
| Tratados jurídicos | Droit |

À stocker dans `classify.yml` aux côtés du mapping heuristique générique.

## Mises à jour de schema cache

Ajouter à la table `books` :

```sql
ALTER TABLE books ADD COLUMN id_type TEXT;  -- bdh|bne_cat|ia|unknown
ALTER TABLE books ADD COLUMN bne_uri TEXT;  -- URL canonique datos.bne.es
```

Et la table `bridges` indiquée plus haut.

## Mise à jour des dépendances

Ajouter à `pyproject.toml` :
- `rdflib` — parser RDF/JSON-LD/Turtle
- `pyoxigraph` — triple store embarqué (alternative légère à Jena)

## Critères d'acceptation mis à jour

Sur l'échantillon de 1 000 livres :
- ≥ **90 %** ont une `category` non-fallback (vs 70% prévus, grâce au tgfbne direct)
- ≥ **80 %** ont au moins 3 tags pertinents en espagnol
- ≥ **75 %** ont une cover BDH valide
- ≥ **40 %** ont un QID Wikidata via sameAs (le reste = œuvres obscures, normal)
- ≥ **30 %** ont un comments / description
