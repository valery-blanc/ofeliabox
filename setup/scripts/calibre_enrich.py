#!/usr/bin/env python3
"""
Enrichit une bibliothèque Calibre (metadata.db) avec des métadonnées riches
depuis le dump BNE, Open Library, et Wikidata.

Usage:
  python calibre_enrich.py load-bne-dump --staging DIR [--bne-zip PATH_OR_URL]
  python calibre_enrich.py extract       --books-dir DIR --staging DIR [--limit N]
  python calibre_enrich.py enrich        --staging DIR [--workers 4] [--sources bne,ol,wd]
  python calibre_enrich.py bake          --staging DIR
  python calibre_enrich.py import-db     --books-dir DIR --staging DIR
  python calibre_enrich.py report        --staging DIR
  python calibre_enrich.py run-all       --books-dir DIR --staging DIR [--workers 4] [--sources bne,ol,wd] [--limit N]

Workflow recommande :
  1. load-bne-dump  -- telecharge et indexe le dump BNE (~57 Mo, 2 sec)
  2. run-all --sources bne,ol,wd  -- enrichit depuis BNE local + OL + WD
"""

from __future__ import annotations

import argparse
import difflib
import json
import math
import re
import shutil
import sqlite3
import sys
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Constants ──────────────────────────────────────────────────────────────────

USER_AGENT  = "EduBox-CalibreEnrich/1.0 (ofelia@edubox.local)"
COVER_MIN_BYTES = 5_000

CATEGORY_PATTERNS: list[tuple[str, list[str]]] = [
    ('Roman',        ['novela', 'novel', 'ficcion', 'fiction', 'caballeria', 'picaresca', 'caballeresca']),
    ('Poesie',       ['poesia', 'poetry', 'poemas', 'verse', 'lirica', 'oda', 'soneto']),
    ('Theatre',      ['teatro', 'drama', 'plays', 'comedia', 'tragedia', 'zarzuela', 'autos sacramentales']),
    ('Nouvelles',    ['cuentos', 'short stories', 'relatos', 'novelas cortas']),
    ('Essai',        ['ensayos', 'essays', 'filosofia', 'philosophy', 'pensamiento', 'discurso']),
    ('Histoire',     ['historia', 'history', 'cronica', 'chronicle', 'anales', 'memorias historicas']),
    ('Religion',     ['religion', 'teologia', 'sermons', 'sermones', 'mistica', 'devocional', 'hagiografia']),
    ('Biographie',   ['biografia', 'biography', 'memoirs', 'memorias', 'autobiografia']),
    ('Voyage',       ['viajes', 'travel', 'expedicion', 'exploration', 'topografia']),
    ('Sciences',     ['ciencia', 'science', 'matematicas', 'fisica', 'quimica', 'botanica', 'medicina']),
    ('Droit',        ['derecho', 'law', 'jurisprudencia', 'legislacion', 'fueros', 'recopilacion']),
    ('Art',          ['arte', 'pintura', 'musica', 'arquitectura', 'escultura']),
    ('Linguistique', ['linguistica', 'gramatica', 'diccionario', 'retorica', 'ortografia']),
    ('Autre',        []),  # fallback
]

# Mapping direct tgfbne (Género/Forma BNE) → category
# Clés normalisées (sans accents, minuscules, sans suffixe " --")
TGFBNE_MAP: dict[str, str] = {
    'novelas':                    'Roman',
    'novela':                     'Roman',
    'novelas historicas':         'Roman',
    'novelas picarescas':         'Roman',
    'cuentos':                    'Nouvelles',
    'relatos':                    'Nouvelles',
    'poesias':                    'Poesie',
    'poesia lirica':              'Poesie',
    'romances':                   'Poesie',
    'villancicos':                'Poesie',
    'villancicos polifonicos':    'Poesie',
    'gozos':                      'Religion',
    'teatro':                     'Theatre',
    'comedias':                   'Theatre',
    'comedias (literatura)':      'Theatre',
    'entremeses':                 'Theatre',
    'entremeses (literatura)':    'Theatre',
    'zarzuelas':                  'Theatre',
    'tragedias':                  'Theatre',
    'alegaciones en derecho':     'Droit',
    'legislacion':                'Droit',
    'reglamentos':                'Droit',
    'tratados juridicos':         'Droit',
    'relaciones de sucesos':      'Histoire',
    'cronicas':                   'Histoire',
    'historia':                   'Histoire',
    'biografias':                 'Biographie',
    'memorias':                   'Biographie',
    'memoriales':                 'Essai',
    'ensayos':                    'Essai',
    'discursos':                  'Essai',
    'sermones':                   'Religion',
    'sermones funebres':          'Religion',
    'sermones panegiricos':       'Religion',
    'tratados religiosos':        'Religion',
    'libros de viajes':           'Voyage',
    'diccionarios':               'Linguistique',
    'gramaticas':                 'Linguistique',
    'tratados cientificos':       'Sciences',
    'fotografia':                 'Art',
    'almanaques':                 'Autre',
    'manuscritos':                'Autre',
}

# ── Rate Limiter (token bucket, stdlib only) ───────────────────────────────────

class RateLimiter:
    def __init__(self, rate_per_sec: float) -> None:
        self._rate   = rate_per_sec
        self._tokens = rate_per_sec
        self._last   = time.monotonic()
        self._lock   = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            self._tokens = min(self._rate, self._tokens + (now - self._last) * self._rate)
            self._last = now
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return
            wait_time = (1.0 - self._tokens) / self._rate
            self._tokens = 0.0
        time.sleep(wait_time)

# ── HTTP helpers ───────────────────────────────────────────────────────────────

def _fetch_json(url: str, timeout: int = 20) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8', errors='replace'))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise

def _fetch_bytes(url: str, timeout: int = 25) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except Exception:
        return None

# ── Manifest DB ────────────────────────────────────────────────────────────────

def init_manifest(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS books (
            id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            calibre_id  INTEGER NOT NULL,
            identifier  TEXT    NOT NULL UNIQUE,
            title       TEXT,
            author      TEXT,
            pubdate     TEXT
        );
        CREATE TABLE IF NOT EXISTS source_data (
            id       INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            book_id  INTEGER NOT NULL REFERENCES books(id),
            source   TEXT    NOT NULL,
            status   TEXT    NOT NULL,
            payload  TEXT,
            UNIQUE(book_id, source)
        );
        CREATE TABLE IF NOT EXISTS enriched (
            id           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            book_id      INTEGER NOT NULL REFERENCES books(id) UNIQUE,
            tags         TEXT,
            series       TEXT,
            series_index REAL    DEFAULT 1.0,
            comments     TEXT,
            category     TEXT,
            shelf        TEXT,
            cover_url    TEXT,
            cover_path   TEXT
        );
        CREATE TABLE IF NOT EXISTS state (
            book_id  INTEGER NOT NULL PRIMARY KEY REFERENCES books(id),
            phase    TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_state_phase ON state(phase);
    """)
    conn.commit()
    return conn

def _books_for_phase(conn: sqlite3.Connection, phase: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT b.* FROM books b JOIN state s ON s.book_id = b.id WHERE s.phase = ?",
        (phase,)
    ).fetchall()

# ── String helpers ─────────────────────────────────────────────────────────────

def _normalize(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if not unicodedata.combining(c))

def _strip_html(s: str) -> str:
    return re.sub(r'<[^>]+>', '', s or '').strip()

def _title_sim(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, _normalize(a), _normalize(b)).ratio()

def _parse_subjects(raw: object) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        raw = [raw]
    out: list[str] = []
    for s in raw:
        for part in re.split(r'[;,|/]', str(s)):
            part = part.strip()
            if len(part) > 2:
                out.append(part)
    return out

def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        key = _normalize(item)
        if key and key not in seen:
            seen.add(key)
            out.append(item)
    return out

def map_tgfbne(genre_str: str) -> str:
    """Mappe un champ Género/Forma BNE vers une category. Retourne '' si inconnu."""
    if not genre_str:
        return ''
    for part in genre_str.split('//'):
        # Nettoyer : supprimer les suffixes hiérarchiques " -- " et normaliser
        clean = re.sub(r'\s*--\s*$', '', part.strip())
        clean = re.sub(r'\s*--\s*S\.\s*\w+\s*$', '', clean)  # suffixe siècle " -- S.XVI-XVII"
        key = _normalize(clean)
        if key in TGFBNE_MAP:
            return TGFBNE_MAP[key]
    return ''


def classify_category(subjects: list[str]) -> str:
    combined = ' '.join(_normalize(s) for s in subjects)
    for category, patterns in CATEGORY_PATTERNS:
        if not patterns:
            return category
        if any(p in combined for p in patterns):
            return category
    return 'Autre'

def compute_century(pubdate: str | None) -> str:
    m = re.search(r'(\d{4})', str(pubdate or ''))
    if not m:
        return 'sd'
    year = int(m.group(1))
    if not (1000 <= year <= 2100):
        return 'sd'
    return f"{math.floor(year / 100) + 1}e"

def download_cover(url: str, dest: Path) -> bool:
    if dest.exists():
        return True
    data = _fetch_bytes(url)
    if not data or len(data) < COVER_MIN_BYTES:
        return False
    dest.write_bytes(data)
    return True

# ── Phase Extract ──────────────────────────────────────────────────────────────

def cmd_extract(books_dir: Path, staging_dir: Path, limit: int = 0) -> None:
    staging_dir.mkdir(parents=True, exist_ok=True)
    (staging_dir / 'covers').mkdir(exist_ok=True)

    conn_cal = sqlite3.connect(books_dir / 'metadata.db')
    conn_man = init_manifest(staging_dir / 'manifest.db')

    query = "SELECT id, lccn, title, author_sort, pubdate FROM books ORDER BY id"
    if limit > 0:
        query += f" LIMIT {limit}"
    rows = conn_cal.execute(query).fetchall()
    conn_cal.close()

    added = skipped = 0
    for calibre_id, identifier, title, author, pubdate in rows:
        ident = identifier or f"unknown-{calibre_id}"
        try:
            conn_man.execute(
                "INSERT OR IGNORE INTO books(calibre_id, identifier, title, author, pubdate) VALUES (?,?,?,?,?)",
                (calibre_id, ident, title, author, pubdate)
            )
            if conn_man.execute("SELECT changes()").fetchone()[0]:
                book_id = conn_man.execute(
                    "SELECT id FROM books WHERE identifier=?", (ident,)
                ).fetchone()[0]
                conn_man.execute(
                    "INSERT OR IGNORE INTO state(book_id, phase) VALUES (?,?)",
                    (book_id, 'extracted')
                )
                added += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"  [!] calibre_id={calibre_id} ignore : {e}", flush=True)

        if (added + skipped) % 500 == 0 and (added + skipped):
            conn_man.commit()
            print(f"  {added + skipped} livres traites...", flush=True)

    conn_man.commit()
    conn_man.close()
    print(f"Extract : {added} ajoutes, {skipped} deja presents.", flush=True)

# ── Phase Enrich — fetch functions ────────────────────────────────────────────

def fetch_ia(book: sqlite3.Row, lim: RateLimiter) -> tuple[str, dict | None]:
    ident = book['identifier']
    for attempt in range(3):
        try:
            lim.wait()
            data = _fetch_json(f"https://archive.org/metadata/{ident}")
            if not data or 'metadata' not in data:
                return ('not_found', None)
            meta = data['metadata']
            subjects  = _parse_subjects(meta.get('subject'))
            desc      = _strip_html(str(meta.get('description', '') or ''))
            payload: dict = {'subjects': subjects, 'description': desc[:1000], 'cover_url': None}
            lim.wait()
            cover = _fetch_bytes(f"https://archive.org/services/img/{ident}", timeout=15)
            if cover and len(cover) >= COVER_MIN_BYTES:
                payload['cover_url'] = f"https://archive.org/services/img/{ident}"
            return ('ok', payload)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ('not_found', None)
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return ('error', {'msg': f"HTTP {e.code}"})
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return ('error', {'msg': str(e)[:200]})
    return ('error', {'msg': 'max retries'})


def fetch_ol(book: sqlite3.Row, lim: RateLimiter) -> tuple[str, dict | None]:
    title  = book['title'] or ''
    author = book['author'] or ''
    if not title:
        return ('not_found', None)
    for attempt in range(3):
        try:
            lim.wait()
            q = urllib.parse.urlencode({
                'title': title, 'author': author,
                'limit': '5', 'fields': 'key,title,subject,cover_i',
            })
            data = _fetch_json(f"https://openlibrary.org/search.json?{q}")
            if not data or not data.get('docs'):
                return ('not_found', None)
            best = next(
                (d for d in data['docs'] if _title_sim(title, d.get('title', '')) >= 0.75),
                None
            )
            if not best:
                return ('not_found', None)
            subjects  = _parse_subjects(best.get('subject', []))
            cover_url = (f"https://covers.openlibrary.org/b/id/{best['cover_i']}-L.jpg"
                         if best.get('cover_i') else None)
            description = ''
            work_key = best.get('key', '')
            if work_key:
                lim.wait()
                work = _fetch_json(f"https://openlibrary.org{work_key}.json")
                if work:
                    raw_desc = work.get('description', '')
                    if isinstance(raw_desc, dict):
                        raw_desc = raw_desc.get('value', '')
                    description = _strip_html(str(raw_desc or ''))[:1000]
                    if not subjects:
                        subjects = _parse_subjects(work.get('subjects', []))
            return ('ok', {'subjects': subjects, 'description': description, 'cover_url': cover_url})
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ('not_found', None)
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return ('error', {'msg': f"HTTP {e.code}"})
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return ('error', {'msg': str(e)[:200]})
    return ('error', {'msg': 'max retries'})


def fetch_wd(book: sqlite3.Row, lim: RateLimiter) -> tuple[str, dict | None]:
    title = book['title'] or ''
    if not title:
        return ('not_found', None)
    book_terms = {'novela', 'libro', 'obra', 'novel', 'poem', 'play', 'drama', 'comedia', 'cuento'}
    for attempt in range(3):
        try:
            lim.wait()
            q = urllib.parse.urlencode({
                'action': 'wbsearchentities', 'search': title[:80],
                'language': 'es', 'type': 'item', 'limit': '5', 'format': 'json',
            })
            data = _fetch_json(f"https://www.wikidata.org/w/api.php?{q}")
            if not data or not data.get('search'):
                return ('not_found', None)
            qid = next(
                (r['id'] for r in data['search']
                 if any(t in _normalize(r.get('description', '')) for t in book_terms)),
                None
            )
            if not qid:
                return ('not_found', None)

            lim.wait()
            q2 = urllib.parse.urlencode({
                'action': 'wbgetentities', 'ids': qid,
                'props': 'claims', 'format': 'json',
            })
            entity_data = _fetch_json(f"https://www.wikidata.org/w/api.php?{q2}")
            if not entity_data:
                return ('not_found', None)
            claims = entity_data.get('entities', {}).get(qid, {}).get('claims', {})

            genre_qids = [
                s['mainsnak']['datavalue']['value']['id']
                for s in claims.get('P136', [])
                if s.get('mainsnak', {}).get('datavalue')
            ]
            series_qid: str | None = None
            series_index = 1.0
            for s in claims.get('P179', []):
                if s.get('mainsnak', {}).get('datavalue'):
                    series_qid = s['mainsnak']['datavalue']['value']['id']
                    break
            for s in claims.get('P1545', []):
                if s.get('mainsnak', {}).get('datavalue'):
                    try:
                        series_index = float(s['mainsnak']['datavalue']['value'])
                    except Exception:
                        pass
                    break

            all_qids = genre_qids + ([series_qid] if series_qid else [])
            if not all_qids:
                return ('ok', {'genres': [], 'series': None, 'series_index': 1.0})

            lim.wait()
            q3 = urllib.parse.urlencode({
                'action': 'wbgetentities', 'ids': '|'.join(all_qids[:10]),
                'props': 'labels', 'languages': 'es|en', 'format': 'json',
            })
            labels_data = _fetch_json(f"https://www.wikidata.org/w/api.php?{q3}")

            def get_label(qid_: str) -> str | None:
                ent = (labels_data or {}).get('entities', {}).get(qid_, {})
                for lang in ('es', 'en'):
                    if lang in ent.get('labels', {}):
                        return ent['labels'][lang]['value']
                return None

            genres = [lb for qid_ in genre_qids if (lb := get_label(qid_))]
            series = get_label(series_qid) if series_qid else None
            return ('ok', {'genres': genres, 'series': series, 'series_index': series_index})

        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ('not_found', None)
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return ('error', {'msg': f"HTTP {e.code}"})
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                return ('error', {'msg': str(e)[:200]})
    return ('error', {'msg': 'max retries'})


def fetch_bne(_book: sqlite3.Row, _lim: RateLimiter) -> tuple[str, None]:
    # Stub réseau — utiliser fetch_bne_local à la place (lookup SQLite local).
    return ('not_found', None)


# ── BNE local lookup (dump indexé) ────────────────────────────────────────────

_bne_tls = threading.local()

def _bne_local_conn(bne_index_path: Path) -> sqlite3.Connection:
    if not hasattr(_bne_tls, 'conn'):
        _bne_tls.conn = sqlite3.connect(str(bne_index_path), check_same_thread=False)
        _bne_tls.conn.execute("PRAGMA query_only = ON")
    return _bne_tls.conn


def fetch_bne_local(book: sqlite3.Row, bne_index_path: Path | None) -> tuple[str, dict | None]:
    if not bne_index_path or not bne_index_path.exists():
        return ('not_found', None)
    conn = _bne_local_conn(bne_index_path)
    row = conn.execute(
        "SELECT tema, genre, resume FROM bne WHERE bdh_id=?", (book['identifier'],)
    ).fetchone()
    if not row:
        return ('not_found', None)
    tema, genre, resume = row
    if not tema and not genre and not resume:
        return ('not_found', None)
    subjects = _parse_subjects((tema or '').split('//'))
    return ('ok', {
        'subjects': subjects,
        'genre':    (genre  or '').strip(),
        'resume':   (resume or '').strip(),
    })


# ── load-bne-dump ──────────────────────────────────────────────────────────────

BNE_DUMP_URL = "https://www.bne.es/media/datosgob/bdh/dominiopublico/dominiopublico_csv-utf8.zip"

def cmd_load_bne_dump(staging_dir: Path, bne_zip: str | None = None) -> None:
    """Telecharge (si URL) et indexe le dump BNE CSV dans staging/bne_index.db."""
    import io, zipfile, ssl, os

    staging_dir.mkdir(parents=True, exist_ok=True)
    index_path = staging_dir / 'bne_index.db'
    source = bne_zip or BNE_DUMP_URL

    # Téléchargement si c'est une URL
    if source.startswith('http'):
        print(f"Telechargement dump BNE depuis {source[:60]}...", flush=True)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(source, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, context=ctx, timeout=120) as r:
            size = int(r.headers.get('content-length', 0))
            if size:
                print(f"  Taille: {size // 1_000_000} Mo", flush=True)
            zip_data = io.BytesIO()
            downloaded = 0
            while True:
                chunk = r.read(1_000_000)
                if not chunk:
                    break
                zip_data.write(chunk)
                downloaded += len(chunk)
                if downloaded % 10_000_000 == 0:
                    print(f"  {downloaded // 1_000_000} Mo...", flush=True)
            zip_data.seek(0)
        print(f"  Telecharge : {downloaded // 1_000_000} Mo", flush=True)
    else:
        print(f"Lecture dump local : {source}", flush=True)
        with open(source, 'rb') as f:
            zip_data = io.BytesIO(f.read())

    # Construction de l'index SQLite
    if index_path.exists():
        os.remove(index_path)
    conn = sqlite3.connect(index_path)
    conn.execute("""CREATE TABLE bne (
        bdh_id TEXT PRIMARY KEY,
        bne_id TEXT,
        tema   TEXT,
        genre  TEXT,
        resume TEXT
    )""")

    import time
    t0 = time.time()
    zf = zipfile.ZipFile(zip_data)
    total_rows = indexed = 0

    for fname in zf.namelist():
        with zf.open(fname) as f:
            content = f.read().decode('utf-8', errors='replace')
        lines = content.split('\n')
        if len(lines) < 2:
            continue
        cols = [c.strip() for c in lines[0].split(';')]
        try:
            idx_id    = cols.index('idBNE')
            idx_vd    = cols.index('version_digital')
            idx_tema  = cols.index('Tema')
            idx_genre = cols.index('Género/Forma')
            idx_res   = cols.index('Resumen')
        except ValueError:
            continue
        for line in lines[1:]:
            vals = line.split(';')
            if len(vals) <= idx_vd:
                continue
            total_rows += 1
            bdh_ids = re.findall(r'\?id=(\d{10})', vals[idx_vd])
            if not bdh_ids:
                continue
            bne_id = vals[idx_id].strip() if idx_id < len(vals) else ''
            tema   = vals[idx_tema].strip()  if idx_tema  < len(vals) else ''
            genre  = vals[idx_genre].strip() if idx_genre < len(vals) else ''
            resume = vals[idx_res].strip()   if idx_res   < len(vals) else ''
            for bid in bdh_ids:
                try:
                    conn.execute("INSERT OR IGNORE INTO bne VALUES (?,?,?,?,?)",
                                 (bid, bne_id, tema, genre, resume))
                    indexed += 1
                except Exception:
                    pass

    conn.commit()
    indexed_count = conn.execute("SELECT COUNT(*) FROM bne").fetchone()[0]
    with_tema     = conn.execute("SELECT COUNT(*) FROM bne WHERE tema  != ''").fetchone()[0]
    with_genre    = conn.execute("SELECT COUNT(*) FROM bne WHERE genre != ''").fetchone()[0]
    conn.close()

    elapsed = time.time() - t0
    print(f"Index BNE construit en {elapsed:.1f}s :", flush=True)
    print(f"  {indexed_count:,} BDH IDs indexes", flush=True)
    print(f"  {with_tema:,} avec Tema  ({100*with_tema//max(indexed_count,1)}%)", flush=True)
    print(f"  {with_genre:,} avec Genre ({100*with_genre//max(indexed_count,1)}%)", flush=True)
    print(f"  Index: {index_path} ({os.path.getsize(index_path)//1024} Ko)", flush=True)

# ── Phase Enrich — orchestration ──────────────────────────────────────────────

_FETCH_MAP = {'ia': fetch_ia, 'ol': fetch_ol, 'wd': fetch_wd}

def _enrich_one(
    book: sqlite3.Row,
    active_sources: list[str],
    limiters: dict[str, RateLimiter],
    db_lock: threading.Lock,
    manifest_path: Path,
    bne_index_path: Path | None = None,
) -> None:
    results: dict[str, tuple[str, dict | None]] = {}
    for src in active_sources:
        if src == 'bne':
            try:
                results['bne'] = fetch_bne_local(book, bne_index_path)
            except Exception as e:
                results['bne'] = ('error', {'msg': str(e)[:200]})
        else:
            fn = _FETCH_MAP.get(src)
            if fn:
                try:
                    results[src] = fn(book, limiters[src])
                except Exception as e:
                    results[src] = ('error', {'msg': str(e)[:200]})

    with db_lock:
        conn = sqlite3.connect(manifest_path)
        for src, (status, payload) in results.items():
            conn.execute(
                "INSERT OR REPLACE INTO source_data(book_id, source, status, payload) VALUES (?,?,?,?)",
                (book['id'], src, status, json.dumps(payload) if payload else None)
            )
        conn.execute("UPDATE state SET phase='enriched' WHERE book_id=?", (book['id'],))
        conn.commit()
        conn.close()


def cmd_enrich(staging_dir: Path, workers: int, sources: list[str]) -> None:
    manifest_path  = staging_dir / 'manifest.db'
    bne_index_path = staging_dir / 'bne_index.db'
    if 'bne' in sources and not bne_index_path.exists():
        print("[!] bne_index.db absent — lancer d'abord 'load-bne-dump'.", flush=True)
        print("    La source 'bne' sera ignoree.", flush=True)
        sources = [s for s in sources if s != 'bne']

    conn = init_manifest(manifest_path)
    books = _books_for_phase(conn, 'extracted')
    conn.close()

    if not books:
        print("Aucun livre en phase 'extracted'. Lancer d'abord 'extract'.", flush=True)
        return

    print(f"{len(books)} livres a enrichir (sources: {','.join(sources)}, workers: {workers})...", flush=True)

    limiters: dict[str, RateLimiter] = {
        'ia':  RateLimiter(30.0),
        'ol':  RateLimiter(100 / 60),
        'wd':  RateLimiter(5.0),
    }
    bne_path = bne_index_path if 'bne' in sources else None
    db_lock = threading.Lock()
    done = 0

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(_enrich_one, book, sources, limiters, db_lock, manifest_path, bne_path): book
            for book in books
        }
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                book = futures[future]
                print(f"  [!] {book['identifier']} : {e}", flush=True)
            done += 1
            if done % 100 == 0:
                print(f"  {done}/{len(books)} enrichis...", flush=True)

    print(f"Enrich termine : {done} livres traites.", flush=True)

# ── Phase Bake ────────────────────────────────────────────────────────────────

def cmd_bake(staging_dir: Path) -> None:
    manifest_path = staging_dir / 'manifest.db'
    covers_dir = staging_dir / 'covers'
    covers_dir.mkdir(exist_ok=True)

    conn = init_manifest(manifest_path)
    books = _books_for_phase(conn, 'enriched')
    if not books:
        print("Aucun livre en phase 'enriched'. Lancer d'abord 'enrich'.", flush=True)
        conn.close()
        return

    print(f"{len(books)} livres a bake...", flush=True)
    processed = 0

    for book in books:
        book_id = book['id']
        rows = conn.execute(
            "SELECT source, status, payload FROM source_data WHERE book_id=?", (book_id,)
        ).fetchall()
        payloads: dict[str, dict] = {}
        for src, status, payload in rows:
            if status == 'ok' and payload:
                payloads[src] = json.loads(payload)

        bne = payloads.get('bne', {})
        ia  = payloads.get('ia',  {})
        ol  = payloads.get('ol',  {})
        wd  = payloads.get('wd',  {})

        # Sujets : BNE en priorité (la source la plus fiable pour ce corpus)
        subjects = _dedupe(
            _parse_subjects(bne.get('subjects', [])) +
            _parse_subjects(ia.get('subjects',  [])) +
            _parse_subjects(ol.get('subjects',  [])) +
            [g for g in wd.get('genres', []) if g]
        )

        # Catégorie : mapping tgfbne direct, sinon heuristique
        category = map_tgfbne(bne.get('genre', '')) or classify_category(subjects)
        century  = compute_century(book['pubdate'])
        shelf    = f"es-{century}-{category}"

        tags = _dedupe([category, f"siglo {century}"] + subjects[:6])[:10]

        series       = wd.get('series') or ol.get('series')
        series_index = float(wd.get('series_index') or 1.0)

        # Description : BNE resume en dernier (rare mais précis)
        desc_raw = (ia.get('description') or ol.get('description') or bne.get('resume') or '').strip()
        comments = desc_raw[:2000] if desc_raw else None

        cover_url  = ia.get('cover_url') or ol.get('cover_url')
        cover_path = None
        if cover_url:
            dest = covers_dir / f"{book['calibre_id']}.jpg"
            if download_cover(cover_url, dest):
                cover_path = f"covers/{book['calibre_id']}.jpg"

        conn.execute(
            "INSERT OR REPLACE INTO enriched"
            "(book_id, tags, series, series_index, comments, category, shelf, cover_url, cover_path)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (book_id, json.dumps(tags), series, series_index, comments,
             category, shelf, cover_url, cover_path)
        )
        conn.execute("UPDATE state SET phase='baked' WHERE book_id=?", (book_id,))

        processed += 1
        if processed % 100 == 0:
            conn.commit()
            print(f"  {processed}/{len(books)} baked...", flush=True)

    conn.commit()
    conn.close()
    print(f"Bake termine : {processed} livres traites.", flush=True)

# ── Phase Import ──────────────────────────────────────────────────────────────

def _ensure_custom_columns(conn: sqlite3.Connection) -> dict[str, int]:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS custom_columns (
            id              INTEGER NOT NULL PRIMARY KEY,
            label           TEXT    NOT NULL UNIQUE,
            name            TEXT    NOT NULL,
            datatype        TEXT    NOT NULL,
            mark_for_delete BOOL    DEFAULT 0,
            editable        BOOL    DEFAULT 1,
            display         TEXT    NOT NULL DEFAULT '{}',
            is_multiple     TEXT    DEFAULT NULL,
            normalized      BOOL    DEFAULT 0
        )
    """)
    for label, name in [('category', 'Catégorie'), ('shelf', 'Étagère')]:
        conn.execute(
            "INSERT OR IGNORE INTO custom_columns(label, name, datatype, normalized) VALUES (?,?,?,?)",
            (label, name, 'text', 0)
        )
    conn.commit()

    col_ids: dict[str, int] = {}
    for label in ('category', 'shelf'):
        col_id = conn.execute(
            "SELECT id FROM custom_columns WHERE label=?", (label,)
        ).fetchone()[0]
        col_ids[label] = col_id
        conn.executescript(f"""
            CREATE TABLE IF NOT EXISTS custom_column_{col_id} (
                id    INTEGER NOT NULL PRIMARY KEY,
                value TEXT    NOT NULL,
                UNIQUE(value)
            );
            CREATE TABLE IF NOT EXISTS books_custom_column_{col_id}_link (
                id    INTEGER NOT NULL PRIMARY KEY,
                book  INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                value INTEGER NOT NULL REFERENCES custom_column_{col_id}(id) ON DELETE CASCADE,
                UNIQUE(book)
            );
        """)
    return col_ids


def _insert_tag(conn: sqlite3.Connection, calibre_id: int, tag: str) -> None:
    conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (tag,))
    tag_id = conn.execute("SELECT id FROM tags WHERE name=?", (tag,)).fetchone()[0]
    conn.execute(
        "INSERT OR IGNORE INTO books_tags_link(book, tag) VALUES (?,?)",
        (calibre_id, tag_id)
    )


def _insert_custom_val(conn: sqlite3.Connection, col_id: int, calibre_id: int, value: str | None) -> None:
    if not value:
        return
    conn.execute(f"INSERT OR IGNORE INTO custom_column_{col_id}(value) VALUES (?)", (value,))
    val_id = conn.execute(
        f"SELECT id FROM custom_column_{col_id} WHERE value=?", (value,)
    ).fetchone()[0]
    conn.execute(
        f"INSERT OR REPLACE INTO books_custom_column_{col_id}_link(book, value) VALUES (?,?)",
        (calibre_id, val_id)
    )


def cmd_import_db(books_dir: Path, staging_dir: Path) -> None:
    manifest_path = staging_dir / 'manifest.db'
    conn_man = init_manifest(manifest_path)
    conn_cal = sqlite3.connect(books_dir / 'metadata.db')
    conn_cal.execute("PRAGMA foreign_keys = ON")
    conn_cal.execute("PRAGMA journal_mode = WAL")

    col_ids = _ensure_custom_columns(conn_cal)

    books = _books_for_phase(conn_man, 'baked')
    if not books:
        print("Aucun livre en phase 'baked'. Lancer d'abord 'bake'.", flush=True)
        conn_man.close()
        conn_cal.close()
        return

    print(f"{len(books)} livres a importer dans metadata.db...", flush=True)
    processed = 0

    for book in books:
        enriched = conn_man.execute(
            "SELECT * FROM enriched WHERE book_id=?", (book['id'],)
        ).fetchone()
        if not enriched:
            continue

        calibre_id = book['calibre_id']

        if enriched['tags']:
            for tag in json.loads(enriched['tags']):
                _insert_tag(conn_cal, calibre_id, tag)

        if enriched['comments']:
            conn_cal.execute(
                "INSERT OR REPLACE INTO comments(book, text) VALUES (?,?)",
                (calibre_id, enriched['comments'])
            )

        if enriched['series']:
            conn_cal.execute(
                "INSERT OR IGNORE INTO series(name, sort) VALUES (?,?)",
                (enriched['series'], enriched['series'])
            )
            series_id = conn_cal.execute(
                "SELECT id FROM series WHERE name=?", (enriched['series'],)
            ).fetchone()[0]
            conn_cal.execute(
                "INSERT OR REPLACE INTO books_series_link(book, series) VALUES (?,?)",
                (calibre_id, series_id)
            )

        _insert_custom_val(conn_cal, col_ids['category'], calibre_id, enriched['category'])
        _insert_custom_val(conn_cal, col_ids['shelf'],    calibre_id,        enriched['shelf'])

        if enriched['cover_path']:
            src = staging_dir / enriched['cover_path']
            row = conn_cal.execute("SELECT path FROM books WHERE id=?", (calibre_id,)).fetchone()
            if row and src.exists():
                dst = books_dir / row[0] / 'cover.jpg'
                try:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dst)
                    conn_cal.execute("UPDATE books SET has_cover=1 WHERE id=?", (calibre_id,))
                except Exception as e:
                    print(f"  [!] Cover non copiee (calibre_id={calibre_id}) : {e}", flush=True)

        conn_man.execute("UPDATE state SET phase='imported' WHERE book_id=?", (book['id'],))

        processed += 1
        if processed % 100 == 0:
            conn_cal.commit()
            conn_man.commit()
            print(f"  {processed}/{len(books)} importes...", flush=True)

    conn_cal.commit()
    conn_man.commit()
    conn_cal.close()
    conn_man.close()
    print(f"Import termine : {processed} livres importes.", flush=True)

# ── Phase Report ──────────────────────────────────────────────────────────────

def cmd_report(staging_dir: Path) -> None:
    conn = init_manifest(staging_dir / 'manifest.db')
    total = conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
    print(f"\n=== Rapport - {total} livres ===")

    print("\nPar phase :")
    for row in conn.execute("SELECT phase, COUNT(*) FROM state GROUP BY phase ORDER BY phase"):
        print(f"  {row[0]:12s} : {row[1]:6d}")

    enriched_total = conn.execute("SELECT COUNT(*) FROM enriched").fetchone()[0]
    if enriched_total:
        def pct(n: int) -> str:
            return f"{100 * n // enriched_total}%"

        tags3    = conn.execute("SELECT COUNT(*) FROM enriched WHERE json_array_length(tags) >= 3").fetchone()[0]
        covers   = conn.execute("SELECT COUNT(*) FROM enriched WHERE cover_path IS NOT NULL").fetchone()[0]
        cats     = conn.execute("SELECT COUNT(*) FROM enriched WHERE category IS NOT NULL AND category != 'Autre'").fetchone()[0]
        comments = conn.execute("SELECT COUNT(*) FROM enriched WHERE comments IS NOT NULL AND LENGTH(comments) > 20").fetchone()[0]

        print(f"\nQualite (sur {enriched_total} livres enrichis) :")
        print(f"  >=3 tags      : {tags3:6d}  ({pct(tags3)})")
        print(f"  Couverture    : {covers:6d}  ({pct(covers)})")
        print(f"  Categorie     : {cats:6d}  ({pct(cats)})")
        print(f"  Description   : {comments:6d}  ({pct(comments)})")

        print("\nCategories :")
        for row in conn.execute(
            "SELECT COALESCE(category, 'Autre'), COUNT(*) n FROM enriched GROUP BY category ORDER BY n DESC"
        ):
            print(f"  {row[0]:16s} : {row[1]:6d}")

        print("\nSiecles :")
        for row in conn.execute(
            "SELECT SUBSTR(shelf, 4, 3) c, COUNT(*) n FROM enriched WHERE shelf IS NOT NULL "
            "GROUP BY c ORDER BY c"
        ):
            print(f"  {row[0]:8s} : {row[1]:6d}")

    conn.close()

# ── run-all ───────────────────────────────────────────────────────────────────

def cmd_run_all(books_dir: Path, staging_dir: Path, workers: int, sources: list[str],
                limit: int = 0, bne_zip: str | None = None) -> None:
    if 'bne' in sources:
        bne_index = staging_dir / 'bne_index.db'
        if not bne_index.exists():
            print("=== Phase 0 : load-bne-dump ===", flush=True)
            cmd_load_bne_dump(staging_dir, bne_zip)
        else:
            print(f"Index BNE deja present ({bne_index}), skip load-bne-dump.", flush=True)
    print("\n=== Phase 1/4 : Extract ===", flush=True)
    cmd_extract(books_dir, staging_dir, limit)
    print("\n=== Phase 2/4 : Enrich ===", flush=True)
    cmd_enrich(staging_dir, workers, sources)
    print("\n=== Phase 3/4 : Bake ===", flush=True)
    cmd_bake(staging_dir)
    print("\n=== Phase 4/4 : Import ===", flush=True)
    cmd_import_db(books_dir, staging_dir)
    print("")
    cmd_report(staging_dir)

# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Enrichit une bibliothèque Calibre depuis IA / Open Library / Wikidata"
    )
    sub = parser.add_subparsers(dest='cmd', required=True)

    def bd(p: argparse.ArgumentParser) -> None:
        p.add_argument('--books-dir', required=True, type=Path, help="Dossier contenant metadata.db")

    def st(p: argparse.ArgumentParser) -> None:
        p.add_argument('--staging', required=True, type=Path, help="Dossier de staging (manifest.db, covers/)")

    def ws(p: argparse.ArgumentParser) -> None:
        p.add_argument('--workers',  type=int,    default=4,        help="Threads parallèles (défaut: 4)")
        p.add_argument('--sources',  type=str,    default='ia,ol,wd', help="Sources: ia,ol,wd,bne (défaut: ia,ol,wd)")

    p = sub.add_parser('load-bne-dump', help="Telecharge et indexe le dump BNE CSV"); st(p)
    p.add_argument('--bne-zip', default=None, help="Chemin local du ZIP BNE (defaut: telechargement auto)")
    p = sub.add_parser('extract',   help="Lit metadata.db et peuple manifest.db"); bd(p); st(p)
    p.add_argument('--limit', type=int, default=0, help="Nombre max de livres a extraire (0 = tous)")
    p = sub.add_parser('enrich',    help="Interroge les sources (bne/ol/wd)"); st(p); ws(p)
    p = sub.add_parser('bake',      help="Fusionne les donnees et genere tags/shelf/covers"); st(p)
    p = sub.add_parser('import-db', help="Ecrit les metadonnees enrichies dans metadata.db"); bd(p); st(p)
    p = sub.add_parser('report',    help="Affiche les statistiques d'enrichissement"); st(p)
    p = sub.add_parser('run-all',   help="Enchaine toutes les phases"); bd(p); st(p); ws(p)
    p.add_argument('--limit',   type=int, default=0,    help="Nombre max de livres (0 = tous)")
    p.add_argument('--bne-zip', default=None,           help="Chemin local du ZIP BNE")

    args = parser.parse_args()
    sources = args.sources.split(',') if hasattr(args, 'sources') else []

    if   args.cmd == 'load-bne-dump': cmd_load_bne_dump(args.staging, getattr(args, 'bne_zip', None))
    elif args.cmd == 'extract':       cmd_extract(args.books_dir, args.staging, getattr(args, 'limit', 0))
    elif args.cmd == 'enrich':        cmd_enrich(args.staging, args.workers, sources)
    elif args.cmd == 'bake':          cmd_bake(args.staging)
    elif args.cmd == 'import-db':     cmd_import_db(args.books_dir, args.staging)
    elif args.cmd == 'report':        cmd_report(args.staging)
    elif args.cmd == 'run-all':       cmd_run_all(args.books_dir, args.staging, args.workers, sources,
                                                   getattr(args, 'limit', 0), getattr(args, 'bne_zip', None))


if __name__ == '__main__':
    main()
