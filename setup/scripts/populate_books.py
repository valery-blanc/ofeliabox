#!/usr/bin/env python3
"""
Télécharge N shards du dataset PleIAs/Spanish-PD-Books (HuggingFace)
et génère des EPUBs dans une bibliothèque Calibre-compatible.
Reprise automatique : livres déjà présents dans metadata.db ignorés.

Usage: python3 populate_books.py --shards N [--books-dir /path/to/books]
"""
import argparse
import html
import json
import os
import re
import sqlite3
import sys
import tempfile
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import gc
import uuid as _uuid

import pyarrow.parquet as pq
from ebooklib import epub

HF_API = "https://huggingface.co/api/datasets/PleIAs/Spanish-PD-Books"
HF_BASE = "https://huggingface.co/datasets/PleIAs/Spanish-PD-Books/resolve/main"
DEFAULT_BOOKS_DIR = os.environ.get("BOOKS_DIR", "/opt/edubox/data/books")


def get_shard_urls() -> list[str]:
    req = urllib.request.Request(HF_API, headers={"User-Agent": "Ofelia-Setup/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    filenames = sorted(
        s["rfilename"] for s in data.get("siblings", [])
        if s["rfilename"].endswith(".parquet")
    )
    return [f"{HF_BASE}/{name}" for name in filenames]


def init_calibre_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS books (
            id                INTEGER NOT NULL PRIMARY KEY,
            title             TEXT    NOT NULL DEFAULT '',
            sort              TEXT,
            timestamp         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pubdate           TIMESTAMP,
            series_index      REAL NOT NULL DEFAULT 1.0,
            author_sort       TEXT,
            isbn              TEXT DEFAULT '',
            lccn              TEXT DEFAULT '',
            path              TEXT NOT NULL DEFAULT '',
            has_cover         BOOL DEFAULT 0,
            last_modified     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            uuid              TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS authors (
            id    INTEGER NOT NULL PRIMARY KEY,
            name  TEXT NOT NULL UNIQUE,
            sort  TEXT,
            link  TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS books_authors_link (
            id     INTEGER NOT NULL PRIMARY KEY,
            book   INTEGER NOT NULL REFERENCES books(id)   ON DELETE CASCADE,
            author INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
            UNIQUE(book, author)
        );
        CREATE TABLE IF NOT EXISTS data (
            id                  INTEGER NOT NULL PRIMARY KEY,
            book                INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            format              TEXT NOT NULL,
            uncompressed_size   INTEGER NOT NULL,
            name                TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS publishers (
            id   INTEGER NOT NULL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            sort TEXT,
            link TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS books_publishers_link (
            id        INTEGER NOT NULL PRIMARY KEY,
            book      INTEGER NOT NULL REFERENCES books(id)      ON DELETE CASCADE,
            publisher INTEGER NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
            UNIQUE(book, publisher)
        );
        CREATE TABLE IF NOT EXISTS tags (
            id   INTEGER NOT NULL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            link TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS books_tags_link (
            id   INTEGER NOT NULL PRIMARY KEY,
            book INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            tag  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
            UNIQUE(book, tag)
        );
        CREATE TABLE IF NOT EXISTS comments (
            id   INTEGER NOT NULL PRIMARY KEY,
            book INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
            text TEXT NOT NULL DEFAULT '',
            UNIQUE(book)
        );
        CREATE TABLE IF NOT EXISTS series (
            id   INTEGER NOT NULL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            sort TEXT,
            link TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS books_series_link (
            id     INTEGER NOT NULL PRIMARY KEY,
            book   INTEGER NOT NULL REFERENCES books(id)   ON DELETE CASCADE,
            series INTEGER NOT NULL REFERENCES series(id)  ON DELETE CASCADE,
            UNIQUE(book)
        );
        CREATE TABLE IF NOT EXISTS ratings (
            id     INTEGER NOT NULL PRIMARY KEY,
            rating INTEGER NOT NULL,
            link   TEXT NOT NULL DEFAULT '',
            UNIQUE(rating)
        );
        CREATE TABLE IF NOT EXISTS books_ratings_link (
            id     INTEGER NOT NULL PRIMARY KEY,
            book   INTEGER NOT NULL REFERENCES books(id)   ON DELETE CASCADE,
            rating INTEGER NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
            UNIQUE(book)
        );
        CREATE TABLE IF NOT EXISTS languages (
            id   INTEGER NOT NULL PRIMARY KEY,
            lang_code TEXT NOT NULL UNIQUE,
            link  TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS books_languages_link (
            id           INTEGER NOT NULL PRIMARY KEY,
            book         INTEGER NOT NULL REFERENCES books(id)     ON DELETE CASCADE,
            lang_code    INTEGER NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
            item_order   INTEGER NOT NULL DEFAULT 0,
            UNIQUE(book, lang_code)
        );
        CREATE TABLE IF NOT EXISTS preferences (
            id  INTEGER NOT NULL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            val TEXT NOT NULL
        );
        INSERT OR IGNORE INTO preferences(key, val) VALUES
            ('library_uuid', lower(hex(randomblob(16)))),
            ('db_version', '6'),
            ('calibre_version', '7.0.0');
    """)
    conn.commit()
    return conn


_ISO_DEFAULT = "2000-01-01T00:00:00+00:00"
_YEAR_RE = re.compile(r'\d{4}')

def _to_iso_date(val) -> str:
    if not val:
        return _ISO_DEFAULT
    if isinstance(val, int):
        return f"{max(1000, min(2100, val))}-01-01T00:00:00+00:00"
    s = str(val).strip()
    if re.match(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', s):
        return s if ('+' in s[10:] or 'Z' in s) else s + '+00:00'
    m = re.match(r'(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})', s)
    if m:
        return f"{m.group(1)}T{m.group(2)}+00:00"
    m = _YEAR_RE.search(s)
    if m:
        return f"{max(1000, min(2100, int(m.group())))}-01-01T00:00:00+00:00"
    return _ISO_DEFAULT


def _sanitize(name: str, maxlen: int = 80) -> str:
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', str(name)).strip('. ')
    return name[:maxlen] or "Unknown"


def _book_exists(conn: sqlite3.Connection, lccn: str) -> bool:
    return conn.execute("SELECT 1 FROM books WHERE lccn=?", (lccn,)).fetchone() is not None


def _add_book(
    conn: sqlite3.Connection,
    books_dir: Path,
    identifier: str,
    title: str,
    creator: str,
    pubdate: str,
    text: str,
) -> None:
    author_name = _sanitize(creator or "Desconocido")
    title_clean = _sanitize(title or "Sin título")

    next_id: int = conn.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM books").fetchone()[0]
    rel_path = f"{author_name}/{title_clean} ({next_id})"
    book_dir = books_dir / author_name / f"{title_clean} ({next_id})"
    book_dir.mkdir(parents=True, exist_ok=True)

    epub_name = _sanitize(f"{title_clean} - {author_name}", maxlen=200)
    epub_path = book_dir / f"{epub_name}.epub"

    if not epub_path.exists():
        b = epub.EpubBook()
        b.set_identifier(identifier)
        b.set_title(title or "Sin título")
        b.set_language("es")
        b.add_author(creator or "Desconocido")

        # Build XHTML content (limit to ~200 paragraphs to keep size manageable)
        safe_title = html.escape(title or "Sin título")
        paragraphs = (text or "").split("\n\n")
        body_parts = [f"<h1>{safe_title}</h1>"]
        for para in paragraphs[:500]:
            para = para.strip()
            if para:
                body_parts.append(f"<p>{html.escape(para)}</p>")

        body_html = "\n".join(body_parts) or f"<p>{html.escape(title or 'Sin título')}</p>"
        c = epub.EpubHtml(title=title or "Sin título", file_name="content.xhtml", lang="es")
        c.content = (
            '<html xmlns="http://www.w3.org/1999/xhtml" lang="es">'
            f"<head><title>{html.escape(title or 'Sin título')}</title></head>"
            f"<body>{body_html}</body></html>"
        )
        b.add_item(c)
        b.add_item(epub.EpubNcx())
        b.add_item(epub.EpubNav())
        b.spine = ["nav", c]
        epub.write_epub(str(epub_path), b, {})

    epub_size = epub_path.stat().st_size

    # Upsert author
    row = conn.execute("SELECT id FROM authors WHERE name=?", (author_name,)).fetchone()
    if row:
        author_id = row[0]
    else:
        conn.execute("INSERT INTO authors(name, sort) VALUES(?,?)", (author_name, author_name))
        author_id = conn.execute("SELECT id FROM authors WHERE name=?", (author_name,)).fetchone()[0]

    conn.execute(
        "INSERT INTO books(id, title, sort, pubdate, author_sort, lccn, path, uuid) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (next_id, title or "Sin título", title or "Sin título",
         _to_iso_date(pubdate), author_name, identifier, rel_path,
         str(_uuid.uuid4())),
    )
    conn.execute("INSERT INTO books_authors_link(book, author) VALUES(?,?)", (next_id, author_id))
    conn.execute(
        "INSERT INTO data(book, format, uncompressed_size, name) VALUES(?,?,?,?)",
        (next_id, "EPUB", epub_size, epub_name),
    )
    conn.commit()


def _download_file(url: str, dest: str) -> None:
    """Download with curl to follow HuggingFace CDN redirects reliably."""
    import subprocess
    result = subprocess.run(
        ["curl", "-sL", "--retry", "3", "-o", dest, url],
        capture_output=True, timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f"curl failed ({result.returncode}): {result.stderr.decode()[:200]}")


def process_shard(url: str, conn: sqlite3.Connection, books_dir: Path) -> int:
    added = 0
    with tempfile.NamedTemporaryFile(suffix=".parquet", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        _download_file(url, tmp_path)
        pf = pq.ParquetFile(tmp_path, memory_map=False)
        n_rg = pf.metadata.num_row_groups
        errors = 0
        row_idx = 0
        shard_base = url.split("/")[-1]
        for rg_idx in range(n_rg):
            batch = pf.read_row_group(rg_idx, use_threads=False)
            rows = batch.to_pydict()
            del batch
            gc.collect()
            n = len(rows.get("title", []))
            for i in range(n):
                identifier = str(rows.get("identifier", [""])[i] or f"hf-{shard_base}-{row_idx}")
                row_idx += 1
                if _book_exists(conn, identifier):
                    continue
                try:
                    _add_book(
                        conn, books_dir,
                        identifier,
                        str(rows.get("title", [""])[i] or ""),
                        str(rows.get("creator", [""])[i] or ""),
                        str(rows.get("publication_date", [""])[i] or ""),
                        str(rows.get("text", [""])[i] or ""),
                    )
                    added += 1
                    if added % 100 == 0:
                        print(f"    {added} livres ajoutés ce shard…", flush=True)
                except Exception as exc:
                    errors += 1
                    if errors <= 3:
                        print(f"    ⚠️  Livre {row_idx} ignoré : {exc}", flush=True)
            del rows
            gc.collect()
        if errors:
            print(f"    {errors} livre(s) ignorés (erreurs)", flush=True)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
    return added


def process_local_shard(path: Path, conn: sqlite3.Connection, books_dir: Path) -> int:
    added = 0
    pf = pq.ParquetFile(str(path), memory_map=False)
    n_rg = pf.metadata.num_row_groups
    errors = 0
    row_idx = 0
    for rg_idx in range(n_rg):
        batch = pf.read_row_group(rg_idx, use_threads=False)
        rows = batch.to_pydict()
        del batch
        gc.collect()
        n = len(rows.get("title", []))
        for i in range(n):
            identifier = str(rows.get("identifier", [""])[i] or f"local-{path.stem}-{row_idx}")
            row_idx += 1
            if _book_exists(conn, identifier):
                continue
            try:
                _add_book(
                    conn, books_dir,
                    identifier,
                    str(rows.get("title", [""])[i] or ""),
                    str(rows.get("creator", [""])[i] or ""),
                    str(rows.get("publication_date", [""])[i] or ""),
                    str(rows.get("text", [""])[i] or ""),
                )
                added += 1
                if added % 100 == 0:
                    print(f"    {added} livres ajoutés ce shard…", flush=True)
            except Exception as exc:
                errors += 1
                if errors <= 3:
                    print(f"    ⚠️  Livre {row_idx} ignoré : {exc}", flush=True)
        del rows
        gc.collect()
    if errors:
        print(f"    {errors} livre(s) ignorés (erreurs)", flush=True)
    return added


def main() -> None:
    parser = argparse.ArgumentParser(description="Populate Calibre library from HuggingFace dataset")
    parser.add_argument("--shards", type=int, default=1, help="Nombre de shards à traiter")
    parser.add_argument("--start-shard", type=int, default=1, help="Index du premier shard (1-based)")
    parser.add_argument("--books-dir", default=DEFAULT_BOOKS_DIR, help="Chemin de la bibliothèque Calibre")
    parser.add_argument("--local-dir", default=None, help="Dossier contenant des fichiers .parquet locaux (mode hors-ligne)")
    args = parser.parse_args()

    books_dir = Path(args.books_dir)
    books_dir.mkdir(parents=True, exist_ok=True)
    db_path = books_dir / "metadata.db"
    conn = init_calibre_db(db_path)

    if args.local_dir:
        local_files = sorted(Path(args.local_dir).glob("*.parquet"))
        if not local_files:
            print(f"Aucun fichier .parquet trouvé dans {args.local_dir}", file=sys.stderr)
            sys.exit(1)
        start = max(1, args.start_shard) - 1
        selected_files = local_files[start:start + args.shards]
        print(f"{len(local_files)} fichiers locaux — traitement de {len(selected_files)} (début: {start + 1})", flush=True)
        total_added = 0
        for i, fpath in enumerate(selected_files):
            print(f"Shard {start + i + 1}/{len(local_files)} : {fpath.name}", flush=True)
            try:
                added = process_local_shard(fpath, conn, books_dir)
                total_added += added
                print(f"  ✓ {added} livres ajoutés", flush=True)
            except Exception as exc:
                print(f"  ⚠️  Erreur shard {fpath.name} : {exc}", flush=True)
    else:
        print("Récupération de la liste des shards HuggingFace…", flush=True)
        try:
            urls = get_shard_urls()
        except Exception as exc:
            print(f"Erreur API HuggingFace : {exc}", file=sys.stderr)
            sys.exit(1)

        if not urls:
            print("Aucun shard trouvé. Vérifier la connectivité internet.", file=sys.stderr)
            sys.exit(1)

        start = max(1, args.start_shard) - 1
        selected = urls[start:start + args.shards]
        print(f"{len(urls)} shards disponibles — traitement de {len(selected)} (début: shard {start + 1})", flush=True)

        total_added = 0
        for i, url in enumerate(selected):
            filename = url.split("/")[-1]
            print(f"Shard {start + i + 1}/{len(urls)} : {filename}", flush=True)
            try:
                added = process_shard(url, conn, books_dir)
                total_added += added
                print(f"  ✓ {added} livres ajoutés", flush=True)
            except Exception as exc:
                print(f"  ⚠️  Erreur shard {i + 1} : {exc}", flush=True)

    total = conn.execute("SELECT COUNT(*) FROM books").fetchone()[0]
    conn.close()
    print(f"Bibliothèque : {total} livres total dans {db_path}", flush=True)


if __name__ == "__main__":
    main()
