#!/usr/bin/env python3
"""Ofelia Setup Wizard — assistant d'installation web"""

import fcntl
import glob
import json
import os
import re
import secrets
import socket
import struct
import subprocess
import time
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
    {"id": "gutenberg_mul", "name": "Gutenberg complet", "lang": "Toutes langues", "flag": "🌍",
     "size": "236 Go",  "size_gb": 236.0, "default": False,
     "filename": "gutenberg_mul.zim",
     "url": "https://download.kiwix.org/zim/gutenberg/gutenberg_mul_all_2025-11.zim"},
]

KOLIBRI_CHANNELS = [
    {"id": "khan_en", "name": "Khan Academy", "lang": "English", "flag": "🇬🇧",
     "size": "~37 Go", "size_gb": 37.0, "default": False,
     "channel_id": "1ceff53605e55bef987d88e0908658c5"},
    {"id": "khan_es", "name": "Khan Academy", "lang": "Español", "flag": "🇪🇸",
     "size": "~37 Go", "size_gb": 37.0, "default": False,
     "channel_id": "c1f2b7e6ac9f56a2bb44fa7a48b66dce"},
    {"id": "khan_fr", "name": "Khan Academy", "lang": "Français", "flag": "🇫🇷",
     "size": "~10 Go", "size_gb": 10.0, "default": False,
     "channel_id": "878ec2e6f88c5c268b1be6f202833cd4"},
]

ZIM_BY_ID       = {z["id"]: z for z in ZIMS}
CHANNEL_BY_ID   = {c["id"]: c for c in KOLIBRI_CHANNELS}
APP_IDS         = {a["id"] for a in APPS}
CORE_SERVICES   = ["mariadb", "redis", "memcached", "nginx-proxy",
                   "healthcheck-dashboard", "portainer"]
CALIBRE_SHARDS_DEFAULT = 1

# ─── Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", apps=APPS, zims=ZIMS,
                           kolibri_channels=KOLIBRI_CHANNELS,
                           calibre_shards_default=CALIBRE_SHARDS_DEFAULT)

@app.route("/api/state")
def get_state():
    path = os.path.join(EDUBOX_DIR, "portal", "wizard-state.json")
    if os.path.exists(path):
        with open(path) as f:
            return f.read(), 200, {"Content-Type": "application/json"}
    return "{}", 200, {"Content-Type": "application/json"}

@app.route("/api/update-credentials", methods=["POST"])
def update_credentials():
    updates = request.get_json(silent=True)
    if not updates or not isinstance(updates, dict):
        return {"ok": False, "error": "payload invalide"}, 400
    path = os.path.join(EDUBOX_DIR, "portal", "credentials-data.json")
    existing = {}
    if os.path.exists(path):
        with open(path) as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                pass
    for app_key, fields in updates.items():
        if isinstance(fields, dict):
            if app_key not in existing:
                existing[app_key] = {}
            existing[app_key].update(fields)
    with open(path, "w") as f:
        json.dump(existing, f, indent=2)
    return {"ok": True}

@app.route("/api/install", methods=["POST"])
def install():
    config = request.get_json()
    return Response(
        stream_with_context(_install_stream(config)),
        mimetype="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )

@app.route("/api/upload-background", methods=["POST"])
def upload_background():
    f = request.files.get("file")
    if not f:
        return {"ok": False, "error": "no file"}, 400
    if f.content_length and f.content_length > 5 * 1024 * 1024:
        return {"ok": False, "error": "file too large (max 5 MB)"}, 400
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    mime = f.content_type or ""
    if not any(mime.startswith(a) for a in allowed):
        return {"ok": False, "error": f"unsupported format: {mime}"}, 400
    dest = os.path.join(EDUBOX_DIR, "portal", "assets", "background.png")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    data = f.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        return {"ok": False, "error": "file too large (max 5 MB)"}, 400
    with open(dest, "wb") as out:
        out.write(data)
    return {"ok": True}

# ─── Stream d'installation ─────────────────────────────────────────────────

def _check_zerotier_status():
    """Lit l'état ZeroTier depuis /var/lib/zerotier-one (volume ro monté)."""
    identity_path = "/var/lib/zerotier-one/identity.public"
    networks_dir  = "/var/lib/zerotier-one/networks.d"
    zt_ifaces     = glob.glob("/sys/class/net/zt*")

    if not os.path.exists(identity_path):
        yield _log("  ⚠️  ZeroTier non installé — exécute bootstrap.sh pour l'installer")
        return

    with open(identity_path) as f:
        zt_addr = f.read().strip().split(":")[0]

    joined = glob.glob(os.path.join(networks_dir, "*.conf")) if os.path.isdir(networks_dir) else []
    network_ids = [os.path.basename(p).replace(".conf", "") for p in joined]

    if zt_ifaces:
        iface = os.path.basename(zt_ifaces[0])
        ip = None
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            raw = fcntl.ioctl(s.fileno(), 0x8915, struct.pack("256s", iface[:15].encode()))
            ip = socket.inet_ntoa(raw[20:24])
        except Exception:
            pass
        yield _log(f"  ✓ ZeroTier actif — adresse {zt_addr} — IP {ip or 'non assignée'}")
        if network_ids:
            yield _log(f"  ✓ Réseau rejoint : {', '.join(network_ids)}")
    else:
        yield _log(f"  ℹ️  ZeroTier installé (adresse {zt_addr}) mais interface inactive")
        if network_ids:
            yield _log(f"  ℹ️  Réseau configuré : {', '.join(network_ids)}")
            yield _log("  ℹ️  → Autorise ce nœud sur https://my.zerotier.com si ce n'est pas fait")
        else:
            yield _log("  ⚠️  Aucun réseau rejoint — lance bootstrap.sh pour configurer ZeroTier")

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

        # Digistorm : clone source si absent (repo ne contient que les fichiers custom)
        if "digistorm" in services:
            yield _log("")
            yield from _prepare_digistorm()

        yield _log("")
        yield _log(f"▶ Téléchargement des images Docker ({len(services)} services)...")
        yield from _run_compose(["pull", "--ignore-buildable"] + services)

        yield _log("")
        yield _log("▶ Démarrage des services...")
        yield from _run_compose(["up", "-d", "--build"] + services)

        # PMB/SLiMS : les volumes sont montés en tant qu'ofelia (uid 1000),
        # les containers tournent en www-data (uid 33) — fix après démarrage
        for svc, paths in [
            ("pmb",   ["/var/www/html/pmb/temp", "/var/www/html/pmb/includes"]),
            ("slims", ["/var/www/html/slims/files", "/var/www/html/slims/config"]),
        ]:
            if svc in services:
                subprocess.run(
                    ["docker", "exec", "-u", "root", f"edubox-{svc}",
                     "chown", "-R", "www-data:www-data"] + paths,
                    capture_output=True,
                )
                yield _log(f"  ✓ {svc} — permissions répertoires corrigées")

        # Koha / PMB / SLiMS : la configuration DB et le schéma sont
        # initialisés automatiquement par les entrypoint des containers.
        lib_apps = [a for a in ("koha", "pmb", "slims") if a in services]
        if lib_apps:
            yield _log("")
            yield _log("▶ Koha / PMB / SLiMS — initialisation automatique des bases de données...")
            yield _log("  ℹ️  L'entrypoint de chaque container importe le schéma SQL et crée")
            yield _log("  ℹ️  le compte admin. Cela prend 1-3 minutes selon le container.")
            yield _log("  ℹ️  Identifiants disponibles sur : /credentials.html")

        # ── Réinitialisation mot de passe Moodle ─────────────────
        if "moodle" in services:
            yield _log("")
            yield _log("▶ Réinitialisation du mot de passe administrateur Moodle...")
            yield _log("  ℹ️  En attente de Moodle (jusqu'à 5 min)...")
            if _wait_for_healthy("edubox-moodle", timeout=300):
                result = subprocess.run(
                    ["docker", "exec", "edubox-moodle",
                     "php", "/var/www/html/admin/cli/reset_password.php",
                     "--username=admin",
                     f"--password={passwords['moodle_admin']}"],
                    capture_output=True, text=True, timeout=60,
                )
                if result.returncode == 0:
                    yield _log("  ✓ Mot de passe Moodle réinitialisé")
                else:
                    yield _log(f"  ⚠️  Échec reset Moodle : {(result.stderr or result.stdout).strip()}")
            else:
                yield _log("  ⚠️  Moodle n'est pas prêt — mot de passe non réinitialisé")

        # ── Import canaux Kolibri ───────────────────────────────────
        selected_channels = [CHANNEL_BY_ID[c] for c in config.get("channels", [])
                             if c in CHANNEL_BY_ID]
        if selected_channels and "kolibri" in services:
            yield _log("")
            yield _log("▶ Import des canaux Kolibri (peut prendre plusieurs heures)...")
            yield _log("  ℹ️  En attente de Kolibri (jusqu'à 5 min)...")
            if not _wait_for_healthy("edubox-kolibri", timeout=300):
                yield _log("  ⚠️  Kolibri n'est pas prêt — import annulé")
            else:
                for ch in selected_channels:
                    yield _log(f"  → {ch['flag']} {ch['name']} {ch['lang']} ({ch['size']})")
                    yield from _import_kolibri_channel(ch["channel_id"], ch["name"])

        # ── Bibliothèque HuggingFace (Calibre-web) ─────────────────
        calibre_cfg = config.get("calibre", {})
        if calibre_cfg.get("enabled"):
            n_shards = max(1, int(calibre_cfg.get("shards", CALIBRE_SHARDS_DEFAULT)))
            yield _log("")
            yield _log(f"▶ Bibliothèque PD Espagnol ({n_shards} shard(s) ≈ {n_shards * 1300} livres)…")
            yield from _install_calibre(n_shards)

        # ── Statut ZeroTier ────────────────────────────────────────
        yield _log("")
        yield _log("▶ Accès distant ZeroTier...")
        yield from _check_zerotier_status()

        # ── Sauvegarde état wizard ──────────────────────────────────
        _save_wizard_state(config)

        # ── Vérification santé des services ────────────────────────
        yield _log("")
        yield _log("▶ Vérification des services installés...")
        for svc, status in _report_health(services):
            icon = "✓" if status == "healthy" else ("⏳" if status == "starting" else "⚠️")
            yield _log(f"  {icon} {svc} — {status}")

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
    env_path = os.path.join(EDUBOX_DIR, ".env")

    # Preserve existing passwords from .env if it already exists.
    # MariaDB keeps the password from its first initialization — regenerating
    # would break all DB connections on wizard re-run.
    existing = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    existing[k.strip()] = v.strip()

    def _get(key, length=12):
        return existing.get(key) or secrets.token_urlsafe(length)

    passwords_in = config.get("passwords", {})
    moodle_admin = passwords_in.get("moodle_admin") or _get("MOODLE_ADMIN_PASS")
    mariadb_root = passwords_in.get("mariadb_root") or _get("MARIADB_ROOT_PASS")
    koha_admin   = passwords_in.get("koha_admin")   or _get("KOHA_ADMIN_PASS")
    pmb_admin    = passwords_in.get("pmb_admin")    or _get("PMB_ADMIN_PASS")
    slims_admin  = passwords_in.get("slims_admin")  or _get("SLIMS_ADMIN_PASS")
    generated = {
        "moodle_admin": moodle_admin,
        "mariadb_root": mariadb_root,
        "koha_admin":   koha_admin,
        "pmb_admin":    pmb_admin,
        "slims_admin":  slims_admin,
    }

    lines = [
        "# Généré par Ofelia Setup Wizard",
        f"MARIADB_ROOT_PASS={mariadb_root}",
        f"MOODLE_DB_PASS={_get('MOODLE_DB_PASS')}",
        f"MOODLE_ADMIN_PASS={moodle_admin}",
        f"KOHA_DB_PASS={_get('KOHA_DB_PASS')}",
        f"KOHA_ADMIN_PASS={koha_admin}",
        f"SIP2_GATE_PASS={_get('SIP2_GATE_PASS')}",
        f"SIP2_SELFCHECK_PASS={_get('SIP2_SELFCHECK_PASS')}",
        f"REDIS_PASS={_get('REDIS_PASS', 16)}",
        f"DIGISTORM_SESSION_KEY={_get('DIGISTORM_SESSION_KEY', 32)}",
        f"PMB_DB_PASS={_get('PMB_DB_PASS')}",
        f"PMB_ADMIN_PASS={pmb_admin}",
        f"SLIMS_DB_PASS={_get('SLIMS_DB_PASS')}",
        f"SLIMS_ADMIN_PASS={slims_admin}",
    ]
    with open(env_path, "w") as f:
        f.write("\n".join(lines) + "\n")
    return generated

def _write_credentials(config, passwords):
    data = {
        "moodle":   {"user": "admin",      "password": passwords["moodle_admin"]},
        "kolibri":  {"user": "admin",       "password": "à définir lors du premier démarrage Kolibri"},
        "koha":     {"user": "koha_admin",  "password": passwords["koha_admin"]},
        "pmb":      {"user": "admin",       "password": passwords["pmb_admin"]},
        "slims":    {"user": "admin",       "password": passwords["slims_admin"]},
        "mariadb":  {"user": "root",        "password": passwords["mariadb_root"]},
        "calibre":  {"user": "admin",       "password": passwords.get("calibre_admin", "Admin2026!")},
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
        "data/calibre", "data/books",
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

def _save_wizard_state(config):
    calibre_cfg = config.get("calibre", {})
    state = {
        "apps": config.get("apps", []),
        "zims": config.get("zims", []),
        "channels": config.get("channels", []),
        "calibre": calibre_cfg.get("enabled", False),
        "box_name": config.get("box_name", "Ofelia"),
    }
    path = os.path.join(EDUBOX_DIR, "portal", "wizard-state.json")
    with open(path, "w") as f:
        json.dump(state, f)

def _import_kolibri_channel(channel_id, name):
    container = "edubox-kolibri"
    for step, cmd in [
        ("Téléchargement canal", ["kolibri", "manage", "importchannel", "network", channel_id]),
        ("Import contenu",       ["kolibri", "manage", "importcontent", "network", channel_id]),
    ]:
        yield _log(f"    {step} {name}...")
        result = subprocess.run(
            ["docker", "exec", container] + cmd,
            capture_output=True, text=True, timeout=14400,
        )
        if result.returncode != 0:
            yield _log(f"    ⚠️  {step} : {result.stderr.strip()[:200]}")
        else:
            yield _log(f"    ✓ {step} terminé")

def _prepare_digistorm():
    import shutil, tempfile
    src_dir = os.path.join(EDUBOX_DIR, "digistorm", "src")
    if os.path.exists(os.path.join(src_dir, "package.json")):
        yield _log("▶ Digistorm — source déjà présent")
        return
    yield _log("▶ Clonage du source Digistorm depuis Codeberg...")
    tmp = tempfile.mkdtemp()
    try:
        result = subprocess.run(
            ["git", "clone", "--depth=1",
             "https://codeberg.org/ladigitale/digistorm", tmp],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(f"git clone digistorm : {result.stderr.strip()}")
        for root, dirs, files in os.walk(tmp):
            dirs[:] = [d for d in dirs if d != ".git"]
            for fname in files:
                src_file = os.path.join(root, fname)
                rel = os.path.relpath(src_file, tmp)
                dst_file = os.path.join(src_dir, rel)
                if not os.path.exists(dst_file):
                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                    shutil.copy2(src_file, dst_file)
        yield _log("  ✓ Digistorm — source cloné (fichiers custom préservés)")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

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
    data_dir = os.path.join(EDUBOX_DIR, "kiwix", "data")

    # Build union: installed ZIMs already on disk + newly selected ones
    existing = set()
    if os.path.isdir(data_dir):
        existing = {f for f in os.listdir(data_dir) if f.endswith(".zim")}
    all_zims = list(existing | set(filenames))
    all_zims.sort()

    new_cmd = "--urlRootLocation=/wiki " + " ".join(all_zims)
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

def _wait_for_healthy(container, timeout=300):
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Health.Status}}", container],
            capture_output=True, text=True,
        )
        if result.stdout.strip() == "healthy":
            return True
        time.sleep(10)
    return False

def _report_health(services):
    container_map = {
        "moodle": "edubox-moodle", "kolibri": "edubox-kolibri",
        "koha": "edubox-koha", "pmb": "edubox-pmb", "slims": "edubox-slims",
        "digistorm": "edubox-digistorm", "kiwix": "edubox-kiwix",
        "mariadb": "edubox-mariadb",
    }
    results = []
    for svc in services:
        cname = container_map.get(svc)
        if not cname:
            continue
        result = subprocess.run(
            ["docker", "inspect", "--format", "{{.State.Health.Status}}", cname],
            capture_output=True, text=True,
        )
        status = result.stdout.strip() or "no healthcheck"
        results.append((svc, status))
    return results

def _get_ip():
    try:
        out = subprocess.run(["hostname", "-I"], capture_output=True, text=True)
        return out.stdout.split()[0]
    except Exception:
        return "192.168.50.1"

def _install_calibre(n_shards):
    books_dir = os.path.join(EDUBOX_DIR, "data", "books")
    os.makedirs(books_dir, exist_ok=True)
    os.makedirs(os.path.join(EDUBOX_DIR, "data", "calibre"), exist_ok=True)
    yield _log("  ✓ Répertoires /data/books et /data/calibre créés")

    yield _log("  ▶ Démarrage du service Calibre-Web…")
    yield from _run_compose(["up", "-d", "--no-deps", "calibre"])

    local_parquet_dir = os.path.join(EDUBOX_DIR, "data", "parquet-import")
    local_parquets = sorted(
        f for f in os.listdir(local_parquet_dir)
        if f.endswith(".parquet")
    ) if os.path.isdir(local_parquet_dir) else []

    if local_parquets:
        yield _log(f"  ℹ️  {len(local_parquets)} fichier(s) Parquet local(aux) détecté(s) — mode hors-ligne.")
        yield _log(f"  ▶ Conversion ({n_shards} shard(s) ≈ {n_shards * 1300} livres)…")
        extra_args = ["--local-dir", local_parquet_dir]
    else:
        yield _log(f"  ▶ Téléchargement et conversion ({n_shards} shard(s) ≈ {n_shards * 1300} livres)…")
        extra_args = []

    yield _log("  ℹ️  Cela peut prendre plusieurs minutes. Reprise automatique si interrompu.")
    script = os.path.join(os.path.dirname(__file__), "scripts", "populate_books.py")
    env = os.environ.copy()
    env["BOOKS_DIR"] = books_dir
    try:
        with subprocess.Popen(
            ["python3", script, "--shards", str(n_shards), "--books-dir", books_dir] + extra_args,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env,
        ) as proc:
            for line in proc.stdout:
                yield _log(f"    {line.rstrip()}")
        if proc.returncode == 0:
            yield _log("  ✓ Bibliothèque Calibre générée")
        else:
            yield _log(f"  ⚠️  populate_books.py s'est terminé avec le code {proc.returncode}")
    except Exception as exc:
        yield _log(f"  ⚠️  Erreur populate_books.py : {exc}")

    yield _log("  ▶ Configuration de Calibre-Web (chemin bibliothèque)…")
    if _wait_for_calibre_web():
        ok, msg = _configure_calibre_web()
        yield _log(f"  {'✓' if ok else '⚠️ '} {msg}")
    else:
        yield _log("  ⚠️  Calibre-Web non accessible — configurer manuellement :")
        yield _log("       http://IP/calibre/ → entrer le chemin : /books")

def _wait_for_calibre_web(timeout=120) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen("http://edubox-calibre:8083/", timeout=5)
            return True
        except Exception:
            time.sleep(5)
    return False

def _configure_calibre_web() -> tuple[bool, str]:
    import urllib.parse, http.cookiejar
    base = "http://edubox-calibre:8083"
    try:
        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

        # Check if library is already configured (no login needed yet)
        with opener.open(f"{base}/", timeout=10) as r:
            body = r.read(4096).decode(errors="ignore")
        if "config_calibre_dir" not in body and "/books" in body:
            return True, "Calibre-Web déjà configuré"

        # Login with default credentials
        login_data = urllib.parse.urlencode({
            "username": "admin",
            "password": "admin123",
            "next": "/admin/dbconfig",
        }).encode()
        req = urllib.request.Request(
            f"{base}/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with opener.open(req, timeout=15) as r:
            r.read()

        # Check if config is needed
        with opener.open(f"{base}/admin/dbconfig", timeout=10) as r:
            body = r.read(8192).decode(errors="ignore")
        if "config_calibre_dir" not in body:
            return True, "Calibre-Web déjà configuré"

        # Submit library path
        config_data = urllib.parse.urlencode({"config_calibre_dir": "/books"}).encode()
        req = urllib.request.Request(
            f"{base}/admin/dbconfig",
            data=config_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with opener.open(req, timeout=15) as r:
            r.read()
        return True, "Calibre-Web configuré → chemin /books"
    except Exception as exc:
        return False, f"Configuration manuelle nécessaire (http://IP/calibre/) : {exc}"

# ─── Statut réseau ────────────────────────────────────────────────────────────

@app.route("/api/network/status")
def network_status():
    try:
        # nmcli device show gives per-device blocks with IP4.ADDRESS, no `ip` binary needed
        result = subprocess.run(
            ["nmcli", "-t", "device", "show"],
            capture_output=True, text=True,
        )
        interfaces = []
        for block in result.stdout.split("\n\n"):
            props = {}
            for line in block.strip().splitlines():
                key, _, val = line.partition(":")
                props[key.strip()] = val.strip()

            name = props.get("GENERAL.DEVICE", "")
            if not name:
                continue

            if name.startswith("eth") or name.startswith("en"):
                role, label = "ethernet", "Ethernet"
            elif name == "wlan0":
                role, label = "ap", "WiFi Raspberry Pi"
            elif name.startswith("wlan"):
                role, label = "client", f"Dongle WiFi ({name})"
            elif name.startswith("zt"):
                role, label = "zerotier", "ZeroTier VPN"
            else:
                continue

            state_str = props.get("GENERAL.STATE", "")
            active = "connected" in state_str.lower() or state_str.startswith("100")

            raw_ip = props.get("IP4.ADDRESS[1]", "")
            ip = raw_ip.split("/")[0] if raw_ip else None

            connection = props.get("GENERAL.CONNECTION", "")
            if connection == "--":
                connection = ""

            interfaces.append({
                "iface": name,
                "label": label,
                "role": role,
                "active": active,
                "ip": ip,
                "connection": connection,
            })

        # ZeroTier interfaces are outside NM — detect via /sys/class/net
        seen = {iface["iface"] for iface in interfaces}
        for zt_path in glob.glob("/sys/class/net/zt*"):
            name = os.path.basename(zt_path)
            if name in seen:
                continue
            try:
                with open(f"/sys/class/net/{name}/operstate") as f:
                    operstate = f.read().strip()
            except Exception:
                operstate = "unknown"
            active = operstate == "up"
            ip = None
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                raw = fcntl.ioctl(s.fileno(), 0x8915,
                                  struct.pack("256s", name[:15].encode()))
                ip = socket.inet_ntoa(raw[20:24])
            except Exception:
                pass
            interfaces.append({
                "iface": name,
                "label": "ZeroTier VPN",
                "role": "zerotier",
                "active": active,
                "ip": ip,
                "connection": "",
            })

        order = {"ethernet": 0, "ap": 1, "client": 2, "zerotier": 3}
        interfaces.sort(key=lambda x: order.get(x["role"], 9))
        return {"interfaces": interfaces}
    except Exception as e:
        return {"error": str(e), "interfaces": []}


# ─── WiFi maintenance ─────────────────────────────────────────────────────────

def _wifi_client_iface():
    """Retourne la première interface WiFi non-AP (wlanX != wlan0), ou None."""
    result = subprocess.run(
        ["nmcli", "-t", "-f", "DEVICE,TYPE", "dev"],
        capture_output=True, text=True,
    )
    for line in result.stdout.splitlines():
        parts = line.split(":")
        if len(parts) >= 2 and parts[1] == "wifi" and parts[0] != "wlan0":
            return parts[0]
    return None

@app.route("/api/wifi/interfaces")
def wifi_interfaces():
    iface = _wifi_client_iface()
    if iface:
        return {"found": True, "iface": iface}
    return {"found": False, "iface": None}

@app.route("/api/wifi/scan")
def wifi_scan():
    iface = _wifi_client_iface()
    if not iface:
        return {"found": False, "networks": []}
    result = subprocess.run(
        ["nmcli", "--terse", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list",
         "ifname", iface],
        capture_output=True, text=True,
    )
    seen = set()
    networks = []
    for line in result.stdout.splitlines():
        parts = line.split(":")
        if len(parts) < 3:
            continue
        ssid, signal_str, security = parts[0], parts[1], ":".join(parts[2:])
        if not ssid or ssid in seen:
            continue
        seen.add(ssid)
        try:
            signal = int(signal_str)
        except ValueError:
            signal = 0
        networks.append({"ssid": ssid, "signal": signal, "secured": bool(security.strip())})
    networks.sort(key=lambda n: n["signal"], reverse=True)
    return {"found": True, "iface": iface, "networks": networks}

@app.route("/api/wifi/connect", methods=["POST"])
def wifi_connect():
    data = request.get_json() or {}
    ssid = (data.get("ssid") or "").strip()
    password = (data.get("password") or "").strip()
    if not ssid:
        return {"ok": False, "error": "SSID manquant"}, 400
    iface = _wifi_client_iface()
    if not iface:
        return {"ok": False, "error": "Aucun dongle WiFi détecté"}, 400
    cmd = ["nmcli", "dev", "wifi", "connect", ssid, "ifname", iface]
    if password:
        cmd += ["password", password]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode == 0:
        return {"ok": True, "msg": result.stdout.strip()}
    return {"ok": False, "error": (result.stderr or result.stdout).strip()}

@app.route("/api/wifi/status")
def wifi_status():
    iface = _wifi_client_iface()
    if not iface:
        return {"found": False}
    result = subprocess.run(
        ["nmcli", "-t", "-f", "DEVICE,STATE,CONNECTION,IP4.ADDRESS", "dev", "show", iface],
        capture_output=True, text=True,
    )
    info = {}
    for line in result.stdout.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            info[k.strip()] = v.strip()
    return {
        "found": True,
        "iface": iface,
        "state": info.get("GENERAL.STATE", ""),
        "connection": info.get("GENERAL.CONNECTION", ""),
        "ip": info.get("IP4.ADDRESS[1]", ""),
    }


if __name__ == "__main__":
    print(f"Ofelia Setup Wizard — http://0.0.0.0:8080/")
    print(f"EDUBOX_DIR = {EDUBOX_DIR}")
    app.run(host="0.0.0.0", port=8080, debug=False, threaded=True)
