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
import hmac
import threading
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from flask import (Flask, Response, redirect, render_template, request,
                   session, stream_with_context, url_for)

app = Flask(__name__)
EDUBOX_DIR = os.environ.get("EDUBOX_DIR", "/opt/edubox")
AP_CON_NAME = "Ofelia-AP"

# ─── Catalogues ────────────────────────────────────────────────────────────

APPS = [
    {"id": "moodle",    "name": "Moodle",    "icon": "🎓", "color": "#f98012",
     "desc": "LMS — cours en ligne, quiz, exercices",              "default": True},
    {"id": "kolibri",   "name": "Kolibri",   "icon": "🌍", "color": "#006b8f",
     "desc": "Khan Academy, vidéos éducatives hors-ligne",          "default": True},
    {"id": "digistorm", "name": "Digistorm", "icon": "⚡",  "color": "#0ea5e9",
     "desc": "Sondages, remue-méninges et quiz collaboratifs",      "default": False},
    {"id": "calibre",   "name": "Calibre-Web", "icon": "📕", "color": "#b45309",
     "desc": "Gestion de epub — copier les livres dans /opt/edubox/data/books/", "default": False},
    {"id": "bibliofelia", "name": "BibliOfelia", "icon": "📗", "color": "#3d8c5a",
     "desc": "Gestion de bibliothèque hors-ligne — prêts, usagers, scan ISBN", "default": False},
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
BIBLIOFELIA_REPO = "https://github.com/valery-blanc/BibliOfelia"

# ─── Authentification du portail d'administration ─────────────────────────
# Ce portail pilote Docker, le réseau et toute la configuration de la Box.
# Il était accessible sans mot de passe à quiconque rejoignait le réseau :
# sur un déploiement de terrain, ce n'est pas tenable.
ADMIN_PASSWORD = os.environ.get("OFELIA_ADMIN_PASSWORD", "Ofelia2026!")

# Clé de session persistée sur disque : régénérée à chaque démarrage, elle
# déconnecterait tout le monde à chaque redémarrage de la Box.
_SESSION_KEY_PATH = os.path.join(EDUBOX_DIR, ".admin-session-key")
try:
    with open(_SESSION_KEY_PATH) as _fh:
        app.secret_key = _fh.read().strip()
except OSError:
    app.secret_key = secrets.token_urlsafe(48)
    try:
        with open(_SESSION_KEY_PATH, "w") as _fh:
            _fh.write(app.secret_key)
        os.chmod(_SESSION_KEY_PATH, 0o600)
    except OSError:
        pass

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
)

# Freinage des tentatives : le portail est joignable par tout le réseau
# local, un mot de passe unique se force sinon très vite.
_LOGIN_FAILURES = {}


def _login_blocked_until(ip):
    return _LOGIN_FAILURES.get(ip, (0, 0.0))[1]


def _note_login_failure(ip):
    fails = _LOGIN_FAILURES.get(ip, (0, 0.0))[0] + 1
    # Les deux premières erreurs sont gratuites (faute de frappe), ensuite
    # l'attente double à chaque échec, plafonnée à 5 minutes.
    delay = 0 if fails < 3 else min(300, 5 * 2 ** (fails - 3))
    _LOGIN_FAILURES[ip] = (fails, time.time() + delay)


@app.before_request
def _require_admin_login():
    # Le démarrage de la Box est consultable sans mot de passe : la personne
    # devant la machine au moment de l'allumage est un bibliothécaire, pas un
    # administrateur, et c'est exactement là que la page sert.
    if request.endpoint in ("login", "static", "boot", "demarrage_legacy",
                            "api_boot_status", "api_set_time",
                            "api_time_info", "api_set_timezone",
                            "api_set_ntp"):
        return None
    # Tant que les applications se lancent, la racine mène à la progression.
    if request.path == "/" and _boot_en_cours():
        return redirect(url_for("boot"))
    if session.get("admin_ok"):
        return None
    if session.get("admin_ok"):
        return None
    if request.path.startswith("/api/"):
        return {"ok": False, "error": "authentification requise"}, 401
    return redirect(url_for("login", next=request.path))


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    ip = request.remote_addr or "?"
    if request.method == "POST":
        wait = _login_blocked_until(ip) - time.time()
        if wait > 0:
            error = f"Trop de tentatives — réessaie dans {int(wait) + 1} s."
        elif hmac.compare_digest(request.form.get("password", ""), ADMIN_PASSWORD):
            _LOGIN_FAILURES.pop(ip, None)
            session.permanent = True
            session["admin_ok"] = True
            dest = request.args.get("next") or "/"
            # Ne jamais rediriger ailleurs que sur ce site
            if not dest.startswith("/") or dest.startswith("//"):
                dest = "/"
            return redirect(dest)
        else:
            _note_login_failure(ip)
            error = "Mot de passe incorrect."
    return render_template("login.html", error=error), (401 if error else 200)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ─── Identifiants des applications ────────────────────────────────────────
# Cette page vivait sur le portail public : les mots de passe de Moodle,
# Kolibri, MariaDB et Calibre étaient lisibles par n'importe quel usager.
@app.route("/credentials")
def credentials_page():
    return render_template("credentials.html")


@app.route("/credentials-data.json")
def credentials_data():
    path = os.path.join(EDUBOX_DIR, "portal", "credentials-data.json")
    try:
        with open(path) as fh:
            return Response(fh.read(), mimetype="application/json")
    except OSError:
        return {}, 404


# ─── État des sauvegardes ─────────────────────────────────────────────────
@app.route("/api/backup/status")
def backup_status():
    """Clé présente ? Dernière sauvegarde ? Espace restant ?

    Une clé USB peut mourir sans prévenir (c'est arrivé le 2026-08-21) :
    sans cette page, les sauvegardes s'arrêteraient en silence.
    """
    mount = "/mnt/backup"
    root = os.path.join(mount, "ofelia")

    # /mnt/backup est un point d'automontage : y accéder déclenche le
    # montage réel. `mountpoint` répondrait « oui » même sans clé, d'où la
    # vérification qu'un vrai système de fichiers ext4 est monté.
    try:
        subprocess.run(["ls", mount], capture_output=True, timeout=20)
        mounted = subprocess.run(
            ["findmnt", "-n", "-t", "ext4", mount],
            capture_output=True, timeout=15,
        ).returncode == 0
    except Exception:
        mounted = False

    if not mounted:
        return {
            "key_present": False,
            "level": "error",
            "message": "Clé de sauvegarde absente — aucune sauvegarde n'est effectuée.",
        }

    backups = []
    try:
        backups = sorted(
            d for d in os.listdir(root)
            if d.startswith("20") and os.path.isdir(os.path.join(root, d))
        )
    except OSError:
        pass

    free = ""
    try:
        st = os.statvfs(mount)
        free = f"{st.f_bavail * st.f_frsize / 1e9:.1f} Go"
    except OSError:
        pass

    if not backups:
        return {
            "key_present": True, "count": 0, "free": free,
            "level": "warn",
            "message": "Clé présente, mais aucune sauvegarde enregistrée.",
        }

    last = backups[-1]
    age_h = None
    try:
        mtime = os.path.getmtime(os.path.join(root, last))
        age_h = (time.time() - mtime) / 3600
    except OSError:
        pass

    if age_h is None:
        level, msg = "ok", f"Dernière sauvegarde : {last}"
    elif age_h > 48:
        level = "warn"
        msg = f"Dernière sauvegarde il y a {int(age_h / 24)} jours ({last}) — vérifier."
    elif age_h > 1:
        level, msg = "ok", f"Dernière sauvegarde il y a {int(age_h)} h ({last})"
    else:
        level, msg = "ok", f"Dernière sauvegarde il y a {int(age_h * 60)} min"

    return {
        "key_present": True, "count": len(backups), "free": free,
        "last": last, "age_hours": round(age_h, 1) if age_h is not None else None,
        "level": level, "message": msg,
    }


# ─── Démarrage de la Box ───────────────────────────────────────────────────
# Le fichier d'état est écrit par scripts/ofelia-boot.sh, qui démarre les
# applications une par une. Il vit dans portal/ parce que nginx le sert aussi
# tel quel au portail public.
BOOT_STATUS_PATH = os.path.join(EDUBOX_DIR, "portal", "boot-status.json")
BOOT_PAGE_PATH = os.path.join(EDUBOX_DIR, "portal", "boot.html")


def _boot_status():
    """L'avancement du démarrage, ou None si le fichier n'existe pas encore."""
    try:
        with open(BOOT_STATUS_PATH, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _boot_en_cours():
    d = _boot_status()
    return bool(d) and d.get("etat") == "encours"


def _heure_synchronisee():
    """NTP a-t-il calé l'horloge ? (donc : la Box a-t-elle internet ?)

    Le Pi 5 n'a pas de pile d'horloge : hors tension il ne compte plus et
    repart de la dernière heure enregistrée. Sans NTP, l'heure est fausse.
    """
    try:
        out = subprocess.run(
            ["dbus-send", "--system", "--print-reply",
             "--dest=org.freedesktop.timedate1", "/org/freedesktop/timedate1",
             "org.freedesktop.DBus.Properties.Get",
             "string:org.freedesktop.timedate1", "string:NTPSynchronized"],
            capture_output=True, timeout=15, text=True,
        )
        return "boolean true" in out.stdout
    except Exception:
        return False


@app.route("/boot")
def boot():
    """La page de progression, servie à l'identique sur les deux adresses."""
    try:
        with open(BOOT_PAGE_PATH, encoding="utf-8") as fh:
            return Response(fh.read(), mimetype="text/html")
    except OSError:
        return Response("Page de démarrage introuvable.", status=404,
                        mimetype="text/plain")


@app.route("/demarrage")
def demarrage_legacy():
    """L'ancienne adresse de la page de démarrage, conservée.

    Elle est écrite dans les fiches, dans BUG-036 et probablement dans des
    marque-pages : la casser ferait conclure à une panne de la Box.

    Redirection temporaire (302) et non permanente : un 301 se met en cache
    sans date de péremption, et rendre un jour un autre sens à /demarrage
    obligerait alors à vider le cache de chaque appareil.
    """
    return redirect(url_for("boot"))


# Les URL de vérification, au cas où le fichier d'état vienne d'une version
# de l'orchestrateur qui ne les publiait pas encore.
def _url_depuis_conteneur(url):
    """Traduit une URL de l'orchestrateur pour qu'elle soit joignable ici.

    L'orchestrateur tourne sur l'hôte, où « localhost » désigne nginx. Cet
    assistant tourne dans un conteneur, où « localhost » désigne le conteneur
    lui-même. Sans cette traduction, toute revérification échoue en silence.
    """
    return url.replace("http://localhost", "http://edubox-nginx", 1)


# Vues depuis le conteneur : nginx par son nom, pas « localhost ».
_URLS_SECOURS = {
    "portail": "http://edubox-nginx/",
    "bibliofelia": "http://edubox-nginx/bibliofelia/",
    "moodle": "http://edubox-nginx/moodle/",
    "kolibri": "http://edubox-nginx/kolibri/",
    "bibliotheques": "http://edubox-nginx/wiki/",
    "calibre": "http://edubox-nginx/calibre/",
    "digistorm": "http://edubox-nginx:3000/",
}


def _reverifie_echecs(d):
    """Une étape en échec répond-elle enfin ?

    L'état est figé à l'instant du démarrage. Une application lente à
    démarrer y reste marquée « ne répond pas » alors qu'elle tourne depuis
    des heures — c'est afficher une information fausse avec assurance.

    On ne reteste QUE les étapes en échec : une étape prête n'est pas
    sollicitée, la page reste légère. Si quelque chose a changé, le fichier
    est corrigé sur le disque pour que la lecture suivante n'ait rien à
    refaire.
    """
    etapes = d.get("etapes") or []
    corrige = False

    for e in etapes:
        if e.get("etat") != "echec":
            continue
        url = e.get("url") or _URLS_SECOURS.get(e.get("id"))
        if not url:
            continue
        url = _url_depuis_conteneur(url)
        try:
            with urllib.request.urlopen(url, timeout=6) as r:
                code = r.getcode()
        except urllib.error.HTTPError as exc:
            code = exc.code
        except Exception:
            continue
        if code and code < 500:
            e["etat"] = "pret"
            e["reverifie"] = True
            corrige = True

    if corrige:
        try:
            tmp = BOOT_STATUS_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(d, fh, ensure_ascii=False, indent=2)
            os.replace(tmp, BOOT_STATUS_PATH)
        except OSError:
            pass  # l'affichage reste juste même si l'écriture échoue

    return d


@app.route("/api/boot-status")
def api_boot_status():
    d = _boot_status()
    if d is None:
        # Aucune séquence n'a encore tourné : tout est considéré comme prêt,
        # sinon la page resterait bloquée sur un écran d'attente perpétuel.
        return {"etat": "termine", "etapes": [],
                "heure_fiable": _heure_synchronisee()}
    d = _reverifie_echecs(d)
    d["heure_fiable"] = _heure_synchronisee()
    return d


def _dbus_time(method, *args, iface="org.freedesktop.timedate1"):
    """Un appel à timedated. L'assistant a /run/dbus monté depuis l'hôte."""
    return subprocess.run(
        ["dbus-send", "--system", "--print-reply",
         "--dest=org.freedesktop.timedate1", "/org/freedesktop/timedate1",
         iface + "." + method] + list(args),
        capture_output=True, timeout=25, text=True,
    )


def _fuseau_actuel():
    r = _dbus_time("Get", "string:org.freedesktop.timedate1", "string:Timezone",
                   iface="org.freedesktop.DBus.Properties")
    m = re.search(r'string "([^"]*)"', r.stdout or "")
    return m.group(1) if m else ""


# Les fuseaux réellement installés sur la Box, montés en lecture seule.
HOST_ZONEINFO = "/host-zoneinfo"


def _liste_fuseaux():
    """Les fuseaux que la Box acceptera vraiment.

    systemd en annonce 598, mais Debian n'installe que les 487 fichiers
    correspondants : les alias hérités (US/*, America/Buenos_Aires,
    Asia/Calcutta…) sont listés sans exister sur le disque, et SetTimezone
    les refuse. Proposer un choix que le système rejettera est une faute
    d'interface, on filtre donc sur ce qui est réellement installé.
    """
    r = _dbus_time("ListTimezones")
    zones = re.findall(r'string "([^"]+)"', r.stdout or "")

    # Si le montage manque (conteneur non recréé), on ne filtre pas : mieux
    # vaut une liste trop large qu'une liste vide qui bloquerait tout réglage.
    if not os.path.isdir(HOST_ZONEINFO):
        return zones

    installes = [z for z in zones
                 if os.path.exists(os.path.join(HOST_ZONEINFO, z))]
    return installes or zones


def _ntp_actif():
    """La synchronisation est-elle ALLUMÉE ? (différent de : a-t-elle réussi)

    Une Box sans internet a NTP allumé mais jamais synchronisé. Confondre
    les deux ferait proposer de « réactiver » quelque chose qui l'est déjà.
    """
    r = _dbus_time("Get", "string:org.freedesktop.timedate1", "string:NTP",
                   iface="org.freedesktop.DBus.Properties")
    return "boolean true" in (r.stdout or "")


def _maintenant(tz=None):
    """L'heure locale de la Box, pas celle du conteneur.

    Le conteneur tourne en UTC ; sans cette conversion, la page afficherait
    une heure décalée du décalage horaire — exactement ce qu'elle sert à
    diagnostiquer.
    """
    tz = tz or _fuseau_actuel()
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo(tz))
    except Exception:
        return datetime.now()


@app.route("/api/time-info")
def api_time_info():
    """Tout ce qu'il faut pour afficher et régler l'horloge.

    La liste des fuseaux (près de 600) n'est renvoyée que sur demande
    explicite : inutile de la transmettre à chaque rafraîchissement de la
    page de démarrage, qui interroge cette route toutes les deux secondes.
    """
    tz = _fuseau_actuel()
    n = _maintenant(tz)
    data = {
        "now": n.strftime("%Y-%m-%d %H:%M:%S"),
        "date": n.strftime("%Y-%m-%d"),
        "time": n.strftime("%H:%M:%S"),
        "timezone": tz,
        "utc_offset": n.strftime("%z"),
        "ntp_synced": _heure_synchronisee(),
        "ntp_enabled": _ntp_actif(),
    }
    if request.args.get("zones"):
        data["timezones"] = _liste_fuseaux()
    return data


@app.route("/api/set-timezone", methods=["POST"])
def api_set_timezone():
    tz = (request.get_json(silent=True) or {}).get("timezone", "")
    # On valide contre la liste que systemd accepte réellement, plutôt que
    # par une expression régulière : c'est lui qui fait autorité.
    if tz not in _liste_fuseaux():
        return {"ok": False,
                "error": "Fuseau horaire non installé sur cette Box : %s" % tz}, 400

    r = _dbus_time("SetTimezone", "string:" + tz, "boolean:false")
    if r.returncode != 0:
        detail = (r.stderr or "").strip().splitlines()
        return {"ok": False,
                "error": detail[-1] if detail else "Changement refusé."}, 500

    # time.tzset() ne suffit pas : l'heure locale de ce processus vient de
    # la variable TZ, figée au démarrage du conteneur. On relit donc l'heure
    # côté hôte pour renvoyer quelque chose de juste.
    # `date` s'exécuterait dans le conteneur, donc en UTC : on convertit.
    return {"ok": True, "timezone": tz,
            "now": _maintenant(tz).strftime("%Y-%m-%d %H:%M:%S")}


# Publie par scripts/sd-health.sh, lance par ofelia-sd-health.timer.
SD_HEALTH_PATH = "/opt/edubox/portal/sd-health.json"


@app.route("/api/sd-health")
def api_sd_health():
    """L'état de la carte SD, mesuré par l'hôte.

    L'assistant tourne dans un conteneur : il ne voit ni `dmesg` ni le journal
    de la machine, et n'a pas `vcgencmd`. C'est donc l'hôte qui mesure et
    dépose le résultat dans un fichier partagé — même mécanique que
    `boot-status.json` pour le portail.

    L'âge de la mesure est renvoyé avec elle : un panneau qui affiche des
    chiffres vieux d'une heure sans le dire vaut moins que pas de panneau.
    """
    try:
        with open(SD_HEALTH_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {"indisponible": True}
    genere = data.get("genere_epoch") or 0
    data["age_s"] = max(0, int(time.time()) - int(genere)) if genere else None
    return data


@app.route("/api/set-ntp", methods=["POST"])
def api_set_ntp():
    """Interrupteur de la synchronisation automatique.

    Sans lui, régler l'heure à la main quand la Box a internet serait sans
    effet : NTP la remettrait aussitôt. Le couper est le seul moyen de faire
    tenir un réglage manuel.
    """
    enabled = bool((request.get_json(silent=True) or {}).get("enabled"))
    r = _dbus_time("SetNTP", "boolean:%s" % ("true" if enabled else "false"),
                   "boolean:false")
    if r.returncode != 0:
        detail = (r.stderr or "").strip().splitlines()
        return {"ok": False,
                "error": detail[-1] if detail else "Changement refusé."}, 500
    return {"ok": True, "enabled": enabled}


@app.route("/api/set-time", methods=["POST"])
def api_set_time():
    """Règle l'horloge à partir d'un instant absolu.

    Le navigateur envoie des millisecondes depuis 1970, pas une date écrite :
    le fuseau du téléphone du bibliothécaire et celui de la Box n'ont ainsi
    pas besoin de coïncider pour que l'instant soit juste.
    """
    data = request.get_json(silent=True) or {}
    try:
        epoch_ms = int(data.get("epoch_ms"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "Heure invalide."}, 400

    # Garde-fou : une faute de frappe ne doit pas envoyer la Box en 1970 et
    # périmer tous les prêts d'un coup.
    if not (1735689600000 < epoch_ms < 4102444800000):
        return {"ok": False, "error": "Date hors des limites acceptées "
                                      "(2025-2100)."}, 400

    ntp_avant = _heure_synchronisee()

    # systemd refuse SetTime tant que la synchronisation automatique est
    # active : il faut la couper, même temporairement.
    _dbus_time("SetNTP", "boolean:false", "boolean:false")
    r = _dbus_time("SetTime", "int64:%d" % (epoch_ms * 1000),
                   "boolean:false", "boolean:false")

    if r.returncode != 0:
        _dbus_time("SetNTP", "boolean:true", "boolean:false")
        detail = (r.stderr or "").strip().splitlines()
        return {"ok": False,
                "error": detail[-1] if detail else "Réglage refusé."}, 500

    reponse = {"ok": True,
               "now": _maintenant().strftime("%Y-%m-%d %H:%M:%S"),
               "ntp_desactive": True}
    if ntp_avant:
        # On ne réactive PAS en douce : ce serait annuler le réglage que
        # l'utilisateur vient de faire, sans qu'il comprenne pourquoi.
        reponse["avertissement"] = (
            "La synchronisation automatique a été désactivée pour conserver "
            "ce réglage. Réactivez-la quand la Box aura de nouveau internet."
        )
    return reponse



# ─── Extinction propre de la Box ──────────────────────────────────────────
@app.route("/api/shutdown", methods=["POST"])
def api_shutdown():
    """Arrête les applications puis éteint la Box.

    Les données survivent à une coupure brutale (ext4 journalisé, SQLite en
    WAL, InnoDB), mais le redémarrage qui suit est long : réparation du
    système de fichiers, puis démarrage simultané de toutes les
    applications. Passer par ici évite les deux.
    """
    def _worker():
        time.sleep(1)  # laisser la réponse HTTP partir avant de tout couper
        # On n'arrête PAS les conteneurs à la main : `docker stop` les
        # marquerait comme arrêtés délibérément, et `restart: unless-stopped`
        # refuserait alors de les relancer au démarrage suivant — la Box
        # repartirait vide. systemd arrête docker.service pendant la séquence
        # d'extinction, ce qui les arrête proprement tout en préservant leur
        # état « voulu = démarré ».
        subprocess.run([
            "dbus-send", "--system", "--print-reply",
            "--dest=org.freedesktop.login1", "/org/freedesktop/login1",
            "org.freedesktop.login1.Manager.PowerOff", "boolean:true",
        ], capture_output=True, timeout=30)

    threading.Thread(target=_worker, daemon=True).start()
    return {"ok": True, "message": "Extinction en cours"}


# ─── Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", apps=APPS, zims=ZIMS,
                           kolibri_channels=KOLIBRI_CHANNELS)

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
        yield from _apply_ap_config(passwords["ap_pass"], config.get("box_name", "Ofelia"))

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

        # BibliOfelia : clone du dépôt GitHub (image buildée sur la Pi)
        if "bibliofelia" in services:
            yield _log("")
            yield from _prepare_bibliofelia()
            services.append("bibliofelia-worker")

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

        # ── Calibre-Web — configuration post-démarrage ─────────────
        if "calibre" in services:
            yield _log("")
            yield _log("▶ Calibre-Web — configuration…")
            os.makedirs(os.path.join(EDUBOX_DIR, "data", "books"),   exist_ok=True)
            os.makedirs(os.path.join(EDUBOX_DIR, "data", "calibre"), exist_ok=True)
            if _wait_for_calibre_web():
                ok, msg = _configure_calibre_web()
                yield _log(f"  {'✓' if ok else '⚠️ '} {msg}")
                calibre_pass = passwords.get("calibre_admin", "Admin2026!")
                ok2, msg2 = _set_calibre_password(calibre_pass)
                yield _log(f"  {'✓' if ok2 else '⚠️ '} {msg2}")
            else:
                yield _log("  ⚠️  Calibre-Web non accessible — configurer manuellement :")
                yield _log("       http://IP/calibre/ → entrer le chemin : /books")

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

def _do_apply_ap_config(ssid, ap_pass):
    """Applique SSID + PSK sur la connexion AP via nmcli. Retourne (ok, message)."""
    if ap_pass and len(ap_pass) < 8:
        return False, "Mot de passe WiFi trop court (min. 8 caractères)"
    args = ["nmcli", "con", "mod", AP_CON_NAME, "802-11-wireless.ssid", ssid]
    if ap_pass:
        args += ["802-11-wireless-security.psk", ap_pass]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        return False, result.stderr.strip()[:200]
    subprocess.run(["nmcli", "con", "down", AP_CON_NAME], capture_output=True)
    subprocess.run(["nmcli", "con", "up",   AP_CON_NAME], capture_output=True)
    return True, f"WiFi AP mis à jour — SSID : {ssid}"

def _apply_ap_config(ap_pass, ssid):
    """Wrapper générateur pour _install_stream."""
    ok, msg = _do_apply_ap_config(ssid, ap_pass)
    prefix = "  ✓" if ok else "  ⚠️ "
    yield _log(f"{prefix} {msg}")

def _get_ap_pass():
    """Lit le mot de passe courant de l'AP depuis nmcli (secrets)."""
    result = subprocess.run(
        ["nmcli", "-s", "-t", "-f", "802-11-wireless-security.psk",
         "con", "show", AP_CON_NAME],
        capture_output=True, text=True,
    )
    for line in result.stdout.splitlines():
        if line.startswith("802-11-wireless-security.psk:"):
            return line.split(":", 1)[1].strip()
    return ""

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
    slims_admin   = passwords_in.get("slims_admin")   or _get("SLIMS_ADMIN_PASS")
    calibre_admin = passwords_in.get("calibre_admin") or _get("CALIBRE_ADMIN_PASS") or "Admin2026!"
    ap_pass       = passwords_in.get("ap_pass")       or existing.get("AP_PASS") or "OfeliaBox2024"
    bibliofelia_secret = existing.get("BIBLIOFELIA_SECRET_KEY") or secrets.token_urlsafe(50)
    box_name      = config.get("box_name", existing.get("BOX_NAME", "Ofelia"))
    generated = {
        "moodle_admin":  moodle_admin,
        "mariadb_root":  mariadb_root,
        "koha_admin":    koha_admin,
        "pmb_admin":     pmb_admin,
        "slims_admin":   slims_admin,
        "calibre_admin": calibre_admin,
        "ap_pass":       ap_pass,
    }

    lines = [
        "# Généré par Ofelia Setup Wizard",
        f"BOX_NAME={box_name}",
        f"AP_PASS={ap_pass}",
        f"CALIBRE_ADMIN_PASS={calibre_admin}",
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
        f"BIBLIOFELIA_SECRET_KEY={bibliofelia_secret}",
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
        "calibre":  {"user": "admin",       "password": passwords["calibre_admin"]},
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
        "data/bibliofelia/data", "data/bibliofelia/media",
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
    state = {
        "apps":     config.get("apps", []),
        "zims":     config.get("zims", []),
        "channels": config.get("channels", []),
        "box_name": config.get("box_name", "Ofelia"),
        "ap_pass":  config.get("passwords", {}).get("ap_pass", ""),
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

def _prepare_bibliofelia():
    """Clone (ou met à jour) le dépôt BibliOfelia dans /opt/edubox/bibliofelia."""
    target = os.path.join(EDUBOX_DIR, "bibliofelia")
    git_dir = os.path.join(target, ".git")
    if os.path.isdir(git_dir):
        yield _log("▶ BibliOfelia — dépôt déjà présent, mise à jour...")
        result = subprocess.run(
            ["git", "-C", target, "pull", "--ff-only"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            yield _log(f"  ⚠️  git pull BibliOfelia : {result.stderr.strip()[:200]}")
        else:
            yield _log("  ✓ BibliOfelia — dépôt à jour")
        return
    yield _log("▶ Clonage du dépôt BibliOfelia depuis GitHub...")
    result = subprocess.run(
        ["git", "clone", "--depth=1", BIBLIOFELIA_REPO, target],
        capture_output=True, text=True, timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git clone BibliOfelia : {result.stderr.strip()}")
    yield _log("  ✓ BibliOfelia — dépôt cloné")


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
        "bibliofelia": "edubox-bibliofelia",
        "bibliofelia-worker": "edubox-bibliofelia-worker",
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

def _set_calibre_password(password: str) -> tuple[bool, str]:
    """Change le mot de passe admin Calibre-Web via werkzeug dans le container."""
    script = (
        "from werkzeug.security import generate_password_hash; "
        "import sqlite3; "
        f"h = generate_password_hash({password!r}); "
        "conn = sqlite3.connect('/config/app.db'); "
        "conn.execute('UPDATE user SET password=? WHERE name=?', (h, 'admin')); "
        "conn.commit(); conn.close(); "
        "print('ok')"
    )
    result = subprocess.run(
        ["docker", "exec", "edubox-calibre", "python3", "-c", script],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode == 0 and "ok" in result.stdout:
        return True, "Mot de passe Calibre-Web mis à jour"
    return False, f"Échec changement mot de passe Calibre : {result.stderr.strip()[:120]}"

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

        import shutil
        disk = shutil.disk_usage(EDUBOX_DIR)
        disk_info = {
            "free_gb":  round(disk.free  / 1024**3, 1),
            "total_gb": round(disk.total / 1024**3, 1),
            "used_gb":  round(disk.used  / 1024**3, 1),
        }
        return {"interfaces": interfaces, "disk": disk_info}
    except Exception as e:
        return {"error": str(e), "interfaces": []}


@app.route("/api/current-config")
def current_config():
    env_path = os.path.join(EDUBOX_DIR, ".env")
    env = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip()
    return {
        "moodle_admin":  env.get("MOODLE_ADMIN_PASS", ""),
        "mariadb_root":  env.get("MARIADB_ROOT_PASS", ""),
        "koha_admin":    env.get("KOHA_ADMIN_PASS", ""),
        "pmb_admin":     env.get("PMB_ADMIN_PASS", ""),
        "slims_admin":   env.get("SLIMS_ADMIN_PASS", ""),
        "calibre_admin": env.get("CALIBRE_ADMIN_PASS", ""),
        "box_name":      env.get("BOX_NAME", ""),
        "ap_pass":       env.get("AP_PASS", "") or _get_ap_pass(),
    }


@app.route("/api/ap/update", methods=["POST"])
def ap_update():
    data = request.get_json(force=True) or {}
    ssid = (data.get("ssid") or "").strip()
    ap_pass = (data.get("pass") or "").strip()
    if not ssid:
        return {"ok": False, "error": "Le nom WiFi (SSID) ne peut pas être vide."}, 400
    ok, msg = _do_apply_ap_config(ssid, ap_pass)
    if not ok:
        return {"ok": False, "error": msg}, 500
    # Persist to .env
    env_path = os.path.join(EDUBOX_DIR, ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            content = f.read()
        import re as _re
        content = _re.sub(r"^BOX_NAME=.*$", f"BOX_NAME={ssid}", content, flags=_re.MULTILINE)
        if ap_pass:
            content = _re.sub(r"^AP_PASS=.*$", f"AP_PASS={ap_pass}", content, flags=_re.MULTILINE)
        with open(env_path, "w") as f:
            f.write(content)
    return {"ok": True, "msg": msg}


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

    # Sans ce rescan, nmcli se contente du cache de NetworkManager : un
    # point d'accès tout juste allumé (partage de connexion d'un téléphone)
    # reste invisible pendant plusieurs minutes. Le bouton « Rechercher »
    # doit chercher pour de bon.
    # Un échec est normal et sans gravité : NetworkManager refuse deux
    # balayages trop rapprochés — on liste alors ce qu'il a déjà.
    try:
        subprocess.run(
            ["nmcli", "device", "wifi", "rescan", "ifname", iface],
            capture_output=True, timeout=45,
        )
        # Parcourir les canaux des deux bandes prend quelques secondes ;
        # lister trop tôt renverrait le cache qu'on cherche à remplacer.
        time.sleep(7)
    except subprocess.TimeoutExpired:
        pass

    result = subprocess.run(
        ["nmcli", "--terse", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list",
         "ifname", iface],
        capture_output=True, text=True,
    )
    seen = set()
    networks = []
    for line in result.stdout.splitlines():
        # nmcli --terse échappe les ':' contenus dans les valeurs. Découper
        # sur tous les ':' décalerait les colonnes des SSID qui en
        # contiennent — on ne coupe que sur les séparateurs réels.
        parts = [p.replace("\\:", ":").replace("\\\\", "\\")
                 for p in re.split(r"(?<!\\):", line)]
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


@app.route("/api/ssl/regenerate", methods=["POST"])
def ssl_regenerate():
    result = subprocess.run(
        ["/opt/edubox/scripts/regen-ssl.sh"],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        err = (result.stderr or result.stdout).strip()
        return {"ok": False, "error": err}, 500
    subprocess.run(
        ["docker", "exec", "edubox-nginx", "nginx", "-s", "reload"],
        capture_output=True, timeout=10,
    )
    sans_line = next((l for l in result.stdout.splitlines() if "SANs" in l), "").strip()
    return {"ok": True, "sans": sans_line}


if __name__ == "__main__":
    print(f"Ofelia Setup Wizard — http://0.0.0.0:8080/")
    print(f"EDUBOX_DIR = {EDUBOX_DIR}")
    app.run(host="0.0.0.0", port=8080, debug=False, threaded=True)
