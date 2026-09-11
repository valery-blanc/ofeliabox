#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verifie que l'assistant n'expose aucun secret. BUG-045 / BUG-046.

Trois choses ont ete mesurees sur la Box le 2026-09-10, et non supposees :

  1. `/opt/edubox/.env` etait en **664** — lisible par tout compte de la
     machine, avec dedans le mot de passe root de MariaDB, ceux des admins
     Moodle / Koha / PMB / SLiMS et la cle Django de BibliOfelia.
  2. `/opt/edubox/portal/credentials-data.json` etait en 644, meme probleme.
  3. `/opt/edubox/portal/wizard-state.json` est servi **publiquement** par
     nginx (HTTP 200, sans authentification) et le code y ecrivait `ap_pass`,
     le mot de passe du point d'acces Wi-Fi. Personne ne le lisait : c'etait du
     secret publie pour rien, a portee de quiconque est connecte au reseau —
     y compris au hotspot que ce mot de passe protege.

Lancement (Linux uniquement, les modes POSIX n'existent pas sous Windows) :

    python3 scripts/test_secrets.py
"""
import importlib.util
import json
import os
import stat
import sys
import tempfile

CHEMIN_APP = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "setup", "app.py"
)

if os.name != "posix":
    print("IGNORE : les droits POSIX ne se testent pas sur cette plateforme.")
    sys.exit(0)

# EDUBOX_DIR est lu a l'import : on le detourne vers un repertoire jetable.
RACINE = tempfile.mkdtemp(prefix="ofelia-test-")
os.environ["EDUBOX_DIR"] = RACINE
os.makedirs(os.path.join(RACINE, "portal"), exist_ok=True)

spec = importlib.util.spec_from_file_location("wizard", CHEMIN_APP)
wizard = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(wizard)
except ModuleNotFoundError as exc:
    print("IGNORE : dependance absente (%s). Lancer dans un conteneur." % exc.name)
    sys.exit(0)

echecs = []


def verifier(nom, condition, detail=""):
    if condition:
        print("  OK   %s" % nom)
    else:
        print("  ECHEC %s %s" % (nom, detail))
        echecs.append(nom)


def mode(path):
    return stat.S_IMODE(os.stat(path).st_mode)


print("=== 1. _write_secret_file ecrit en 0600 ===")
cible = os.path.join(RACINE, "secret.txt")
wizard._write_secret_file(cible, "MOT_DE_PASSE=abc\n")
verifier("mode 0600", mode(cible) == 0o600, "-> %o" % mode(cible))
verifier("contenu intact", open(cible).read() == "MOT_DE_PASSE=abc\n")

print("=== 2. un fichier deja trop permissif est durci ===")
laxiste = os.path.join(RACINE, "laxiste.txt")
open(laxiste, "w").write("ancien")
os.chmod(laxiste, 0o664)
wizard._write_secret_file(laxiste, "neuf")
verifier("re-durci en 0600", mode(laxiste) == 0o600, "-> %o" % mode(laxiste))
verifier("tronque, pas ajoute", open(laxiste).read() == "neuf")

print("=== 3. le .env genere est en 0600 ===")
env_path = os.path.join(RACINE, ".env")
wizard._write_env({"apps": [], "passwords": {}, "box_name": "Ofelia"})
verifier(".env existe", os.path.exists(env_path))
if os.path.exists(env_path):
    verifier(".env en 0600", mode(env_path) == 0o600, "-> %o" % mode(env_path))
    cles = [l.split("=")[0] for l in open(env_path) if "=" in l and not l.startswith("#")]
    verifier("BIBLIOFELIA_SECRET_KEY present", "BIBLIOFELIA_SECRET_KEY" in cles)
    verifier("REDIS_PASS present", "REDIS_PASS" in cles)
    verifier("17 cles ecrites", len(cles) == 17, "-> %d" % len(cles))
    vides = [l.strip() for l in open(env_path)
             if "=" in l and not l.startswith("#") and not l.strip().split("=", 1)[1]]
    verifier("aucune valeur vide", not vides, "-> %s" % vides)

print("=== 4. credentials-data.json est en 0600 ===")
wizard._write_credentials({}, {
    "moodle_admin": "a", "mariadb_root": "b", "koha_admin": "c",
    "pmb_admin": "d", "slims_admin": "e", "calibre_admin": "f", "ap_pass": "g",
})
creds = os.path.join(RACINE, "portal", "credentials-data.json")
verifier("credentials-data.json en 0600", mode(creds) == 0o600, "-> %o" % mode(creds))

print("=== 5. wizard-state.json ne contient AUCUN secret ===")
# Ce fichier est servi publiquement : c'est le point le plus important du test.
wizard._save_wizard_state({
    "apps": ["bibliofelia"], "zims": [], "channels": [], "box_name": "Ofelia",
    "passwords": {"ap_pass": "MOT-DE-PASSE-DU-WIFI", "mariadb_root": "SECRET-BDD"},
})
etat_path = os.path.join(RACINE, "portal", "wizard-state.json")
brut = open(etat_path).read()
etat = json.loads(brut)
verifier("pas de cle ap_pass", "ap_pass" not in etat, "-> %s" % sorted(etat))
verifier("le mot de passe Wi-Fi n'apparait nulle part",
         "MOT-DE-PASSE-DU-WIFI" not in brut)
verifier("aucun autre secret n'a fuite", "SECRET-BDD" not in brut)
verifier("le portail a ce dont il a besoin",
         all(k in etat for k in ("apps", "zims")))

print("")
if echecs:
    print("%d ECHEC(S) : %s" % (len(echecs), ", ".join(echecs)))
    sys.exit(1)
print("Tout est vert.")
