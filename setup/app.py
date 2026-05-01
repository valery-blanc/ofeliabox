#!/usr/bin/env python3
"""Ofelia Setup Wizard — assistant d'installation web"""

import json
import os
import re
import secrets
import subprocess
import urllib.request
from flask import Flask, render_template, request, Response, stream_with_context

app = Flask(__name__)
EDUBOX_DIR = os.environ.get("EDUBOX_DIR", "/opt/edubox")

# ─── Catalogues ────────────────────────────────────────────────────────────

APPS = [
    {"id": "moodle",    "name": "Moodle",    "icon": "🎓", "color": "#f98012",
     "desc": "LMS — cours en ligne, quiz, exercices",              "default": True},
    {"id": "kolibri",   "name": "Kolibri",   "icon": "🌍", "color": "#006b8f",
     "desc": "Khan Academy, vidéos éducatives hors-ligne",          "default": True},
    {"id": "koha",      "name": "Koha",      "icon": "📖", "color": "#5c8c4a",
     "desc": "Gestion de bibliothèque (SIGB), scanner USB",         "default": True},
    {"id": "pmb",       "name": "PMB",       "icon": "📚", "color": "#1e40af",
     "desc": "Logiciel de bibliothèque alternatif",                 "default": False},
    {"id": "slims",     "name": "SLiMS",     "icon": "🗂",  "color": "#7c3aed",
     "desc": "Système intégré de bibliothèque open source",         "default": False},
    {"id": "digistorm", "name": "Digistorm", "icon": "⚡",  "color": "#0ea5e9",
     "desc": "Sondages, remue-méninges et quiz collaboratifs",      "default": False},
]

ZIMS = [
    {"id": "wikipedia_es",  "name": "Wikipedia",  "lang": "Español",  "flag": "🇪🇸",
     "size": "3.4 Go",  "size_gb": 3.4,  "default": True,
     "filename": "wikipedia_es.zim",
     "url": "https://download.kiwix.org/zim/wikipedia/wikipedia_es_all_nopic_2026-02.zim"},
    {"id": "wikisource_es", "name": "Wikisource", "lang": "Español",  "flag": "🇪🇸",
     "size": "728 Mo",  "size_gb": 0.7,  "default": False,
     "filename": "wikisource_es.zim",
     "url": "https://download.kiwix.org/zim/wikisource/wikisource_es_all_nopic_2026-04.zim"},
    {"id": "gutenberg_es",  "name": "Gutenberg",  "lang": "Español",  "flag": "🇪🇸",
     "size": "1.7 Go",  "size_gb": 1.7,  "default": False,
     "filename": "gutenberg_es.zim",
     "url": "https://download.kiwix.org/zim/gutenberg/gutenberg_es_all_2026-01.zim"},
    {"id": "wikipedia_fr",  "name": "Wikipedia",  "lang": "Français", "flag": "🇫🇷",
     "size": "1.1 Go",  "size_gb": 1.1,  "default": False,
     "filename": "wikipedia_fr.zim",
     "url": "https://download.kiwix.org/zim/wikipedia/wikipedia_fr_all_mini_2026-02.zim"},
    {"id": "wikisource_fr", "name": "Wikisource", "lang": "Français", "flag": "🇫🇷",
     "size": "11 Go",   "size_gb": 11.0, "default": False,
     "filename": "wikisource_fr.zim",
     "url": "https://download.kiwix.org/zim/wikisource/wikisource_fr_all_nopic_2025-09.zim"},
    {"id": "gutenberg_fr",  "name": "Gutenberg",  "lang": "Français", "flag": "🇫🇷",
     "size": "9.8 Go",  "size_gb": 9.8,  "default": False,
     "filename": "gutenberg_fr.zim",
     "url": "https://download.kiwix.org/zim/gutenberg/gutenberg_fr_all_2026-01.zim"},
]

ZIM_BY_ID       = {z["id"]: z for z in ZIMS}
APP_IDS         = {a["id"] for a in APPS}
CORE_SERVICES   = ["mariadb", "redis", "memcached", "nginx-proxy",
                   "healthcheck-dashboard", "portainer"]

# ─── Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", apps=APPS, zims=ZIMS)

@app.route("/api/install", methods=["POST"])
def install():
    config = request.get_json()
    return Response(
        stream_with_context(_install_stream(config)),
        mimetype="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )

# ─── Stream d'installation ─────────────────────────────────────────────────

def _install_stream(config):
    try:
        yield _log("════════════════════════════════════")
        yield _log("  Ofelia — Installation en cours")
        yield _log("════════════════════════════════════")

        yield _log("")
        yield _log("▶ Écriture de la configuration...")
        passwords = _write_env(config)
        _write_credentials(config, passwords)
        yield _log("  ✓ .env écrit")
        yield _log("  ✓ credentials-data.json écrit")

        yield _log("")
        yield _log("▶ Création des répertoires de données...")
        _create_dirs()
        yield _log("  ✓ Répertoires créés dans /opt/edubox/data/")

        # ── Téléchargement des ZIM ──────────────────────────────────────
        selected_zims = [ZIM_BY_ID[z] for z in config.get("zims", []) if z in ZIM_BY_ID]
        if selected_zims:
            yield _log("")
            yield _log("▶ Téléchargement des bibliothèques hors-ligne...")
        for zim in selected_zims:
            dest = os.path.join(EDUBOX_DIR, "kiwix", "data", zim["filename"])
            label = f"{zim['flag']} {zim['name']} {zim['lang']} ({zim['size']})"
            if os.path.exists(dest):
                yield _log(f"  ✓ {label} — déjà présent")
                continue
            yield _sse({"type": "progress_start", "id": zim["id"], "label": label})
            for pct, dl, total in _download_zim(zim["url"], dest):
                yield _sse({
                    "type": "progress",
                    "id": zim["id"],
                    "pct": pct,
                    "downloaded": f"{dl / 1024**3:.2f}",
                    "total": f"{total / 1024**3:.2f}",
                })
            yield _log(f"  ✓ {label} — téléchargé")

        # ── Patch commande Kiwix ────────────────────────────────────────
        if selected_zims:
            yield _log("")
            yield _log("▶ Mise à jour de la commande Kiwix...")
            _patch_kiwix([z["filename"] for z in selected_zims])
            yield _log("  ✓ docker-compose.yml patché")

        # ── Docker pull + up ────────────────────────────────────────────
        services = CORE_SERVICES + [a for a in config.get("apps", []) if a in APP_IDS]
        if selected_zims:
            services.append("kiwix")

        yield _log("")
        yield _log(f"▶ Téléchargement des images Docker ({len(services)} services)...")
        yield from _run_compose(["pull"] + services)

        yield _log("")
        yield _log("▶ Démarrage des services...")
        yield from _run_compose(["up", "-d", "--build"] + services)

        ip = _get_ip()
        yield _log("")
        yield _log("════════════════════════════════════")
        yield _log("  ✅  Installation terminée !")
        yield _log(f"  Portail : http://{ip}/")
        yield _log("════════════════════════════════════")
        yield _sse({"type": "done", "url": f"http://{ip}/"})

    except Exception as exc:
        yield _log(f"  ❌ ERREUR : {exc}")
        yield _sse({"type": "error", "msg": str(exc)})

# ─── Helpers SSE ───────────────────────────────────────────────────────────

def _sse(data):
    return f"data: {json.dumps(data)}\n\n"

def _log(msg):
    return _sse({"type": "log", "msg": msg})

# ─── Helpers installation ──────────────────────────────────────────────────

def _write_env(config):
    passwords = config.get("passwords", {})
    moodle_admin = passwords.get("moodle_admin") or secrets.token_urlsafe(12)
    mariadb_root = passwords.get("mariadb_root") or secrets.token_urlsafe(12)
    generated = {"moodle_admin": moodle_admin, "mariadb_root": mariadb_root}

    lines = [
        "# Généré par Ofelia Setup Wizard",
        f"MARIADB_ROOT_PASS={mariadb_root}",
        f"MOODLE_DB_PASS={secrets.token_urlsafe(12)}",
        f"MOODLE_ADMIN_PASS={moodle_admin}",
        f"KOHA_DB_PASS={secrets.token_urlsafe(12)}",
        f"SIP2_GATE_PASS={secrets.token_urlsafe(12)}",
        f"SIP2_SELFCHECK_PASS={secrets.token_urlsafe(12)}",
        f"REDIS_PASS={secrets.token_urlsafe(16)}",
        f"DIGISTORM_SESSION_KEY={secrets.token_urlsafe(32)}",
        f"PMB_DB_PASS={secrets.token_urlsafe(12)}",
        f"SLIMS_DB_PASS={secrets.token_urlsafe(12)}",
    ]
    with open(os.path.join(EDUBOX_DIR, ".env"), "w") as f:
        f.write("\n".join(lines) + "\n")
    return generated

def _write_credentials(config, passwords):
    data = {
        "moodle":   {"user": "admin",       "password": passwords["moodle_admin"]},
        "kolibri":  {"user": "admin",        "password": "à définir lors du premier démarrage Kolibri"},
        "koha":     {"user": "koha_edubox",  "password": "à définir lors du setup web Koha"},
        "pmb":      {"user": "admin",        "password": "à définir lors du setup web PMB"},
        "slims":    {"user": "admin",        "password": "admin"},
        "mariadb":  {"user": "root",         "password": passwords["mariadb_root"]},
    }
    path = os.path.join(EDUBOX_DIR, "portal", "credentials-data.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def _create_dirs():
    dirs_uid = {
        "data/mariadb":      (999, 999),
        "data/moodle/data":  (82,  82),
        "data/moodle/html":  (82,  82),
        "data/pmb/data":     (33,  33),
        "data/pmb/config":   (33,  33),
        "data/slims/data":   (33,  33),
        "data/slims/config": (33,  33),
    }
    dirs_plain = [
        "data/kolibri", "data/koha/data", "data/koha/config",
        "data/digistorm", "data/portainer", "kiwix/data",
    ]
    for rel, (uid, gid) in dirs_uid.items():
        path = os.path.join(EDUBOX_DIR, rel)
        os.makedirs(path, exist_ok=True)
        try:
            os.chown(path, uid, gid)
        except (PermissionError, OSError):
            pass
    for rel in dirs_plain:
        os.makedirs(os.path.join(EDUBOX_DIR, rel), exist_ok=True)

def _download_zim(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".tmp"
    req = urllib.request.Request(url, headers={"User-Agent": "Ofelia-Setup/1.0"})
    with urllib.request.urlopen(req, timeout=3600) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        last_pct = -1
        with open(tmp, "wb") as f:
            while True:
                chunk = resp.read(4 * 1024 * 1024)  # 4 MB
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = int(downloaded * 100 / total)
                    if pct != last_pct:
                        last_pct = pct
                        yield pct, downloaded, total
    os.rename(tmp, dest)

def _patch_kiwix(filenames):
    dc_path = os.path.join(EDUBOX_DIR, "docker-compose.yml")
    new_cmd = "--urlRootLocation=/wiki " + " ".join(filenames)
    with open(dc_path) as f:
        content = f.read()
    content = re.sub(
        r"command: --urlRootLocation=/wiki[^\n]*",
        f"command: {new_cmd}",
        content,
    )
    with open(dc_path, "w") as f:
        f.write(content)

def _run_compose(subcmd):
    cmd = ["docker", "compose", "-f", os.path.join(EDUBOX_DIR, "docker-compose.yml")] + subcmd
    with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True) as proc:
        for line in proc.stdout:
            yield _sse({"type": "docker", "msg": line.rstrip()})
    if proc.returncode not in (0, None):
        raise RuntimeError(f"`docker compose {subcmd[0]}` a échoué (code {proc.returncode})")

def _get_ip():
    try:
        out = subprocess.run(["hostname", "-I"], capture_output=True, text=True)
        return out.stdout.split()[0]
    except Exception:
        return "192.168.50.1"

if __name__ == "__main__":
    print(f"Ofelia Setup Wizard — http://0.0.0.0:8080/")
    print(f"EDUBOX_DIR = {EDUBOX_DIR}")
    app.run(host="0.0.0.0", port=8080, debug=False, threaded=True)
