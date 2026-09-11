#!/bin/bash
# ── Ofelia Box — santé de la carte SD ─────────────────────────────────
#
# Une carte SD ne rapporte RIEN à l'hôte : ni température, ni usure, ni
# bridage. Il n'existe pas d'équivalent SMART pour ce format. La seule chose
# observable est le moment où elle cesse de répondre au contrôleur, que le
# noyau signale par « Card stuck being busy ». C'est ce que ce script compte.
#
# On y ajoute la température du processeur : sur une Pi 5, le lecteur de
# carte est juste en dessous, donc c'est le meilleur indicateur indirect de
# ce que subit la carte.
#
# Publié en JSON pour l'assistant, comme boot-status.json l'est pour le
# portail. Le conteneur de l'assistant ne peut pas lire dmesg lui-même
# (ni /dev/kmsg ni le journal de l'hôte ne lui sont montés) : c'est donc
# l'hôte qui mesure et dépose le résultat dans un fichier partagé.

set -uo pipefail

SORTIE=/opt/edubox/portal/sd-health.json
MOTIF="Card stuck being busy"
BLOQUE="blocked for more than"

# ── Blocages de la carte ──────────────────────────────────────────────
# dmesg ne couvre que le démarrage courant ; journalctl remonte plus loin,
# mais seulement depuis que la journalisation persistante existe.
calages_boot=$(dmesg 2>/dev/null | grep -c "$MOTIF")
taches_bloquees=$(dmesg 2>/dev/null | grep -c "$BLOQUE")

compte_depuis() {
    journalctl -k --since "$1" --no-pager -q 2>/dev/null | grep -c "$MOTIF"
}
calages_24h=$(compte_depuis "24 hours ago")
calages_7j=$(compte_depuis "7 days ago")

dernier_calage=$(journalctl -k --since "30 days ago" --no-pager -q -o short-iso 2>/dev/null \
                 | grep "$MOTIF" | tail -1 | cut -d" " -f1)

# Depuis quand le journal garde-t-il une trace ? Sans cette date, « 0 calage
# sur 7 jours » se lirait comme un satisfecit alors que le journal peut
# n'avoir que deux heures.
journal_depuis=$(journalctl --no-pager -q -o short-iso 2>/dev/null | head -1 | cut -d" " -f1)
journal_persistant=false
[ -d /var/log/journal ] && [ -n "$(ls -A /var/log/journal 2>/dev/null)" ] && journal_persistant=true

# ── Température et bridage du processeur ──────────────────────────────
temperature=$(vcgencmd measure_temp 2>/dev/null | tr -dc "0-9.")
throttled=$(vcgencmd get_throttled 2>/dev/null | cut -d= -f2)

# ── Volume écrit et ancienneté du démarrage ───────────────────────────
secteurs=$(awk '/ mmcblk0 / {print $10; exit}' /proc/diskstats 2>/dev/null)
uptime_s=$(cut -d. -f1 /proc/uptime 2>/dev/null)

# ── Durees mesurees par ofelia-sd-stall-watch ─────────────────────────
# Le noyau dit qu'un blocage commence, jamais qu'il finit : la duree ne peut
# venir que de l'observation directe de /proc/diskstats.
BLOCAGES=/var/log/ofelia-sd-blocages.log

export calages_boot calages_24h calages_7j taches_bloquees dernier_calage \
       journal_depuis journal_persistant temperature throttled secteurs uptime_s \
       BLOCAGES

python3 - <<'PY' > "${SORTIE}.tmp"
import json, os, time

def entier(nom, defaut=None):
    v = os.environ.get(nom, "").strip()
    try:
        return int(v)
    except ValueError:
        return defaut

def reel(nom):
    v = os.environ.get(nom, "").strip()
    try:
        return float(v)
    except ValueError:
        return None

def texte(nom):
    return (os.environ.get(nom) or "").strip() or None

# Les drapeaux de vcgencmd : les bits 0-3 décrivent l'instant présent,
# les bits 16-19 disent si l'événement s'est produit depuis l'allumage.
brut = texte("throttled") or ""
try:
    bits = int(brut, 16)
except ValueError:
    bits = None

def bit(n):
    return None if bits is None else bool(bits & (1 << n))

secteurs = entier("secteurs")

# Journal des durees : une ligne par blocage, « ISO<TAB>duree=N<TAB>temp=X ».
duree_dernier = duree_max = None
blocages_24h = 0
debut_mesure = None
try:
    import datetime
    limite = time.time() - 86400
    with open(os.environ.get("BLOCAGES", ""), encoding="utf-8") as fh:
        for ligne in fh:
            morceaux = ligne.strip().split("\t")
            if len(morceaux) < 2 or not morceaux[1].startswith("duree="):
                continue
            try:
                d = float(morceaux[1].split("=", 1)[1])
                quand = datetime.datetime.fromisoformat(morceaux[0]).timestamp()
            except ValueError:
                continue
            if debut_mesure is None:
                debut_mesure = morceaux[0]
            duree_dernier = d
            duree_max = d if duree_max is None else max(duree_max, d)
            if quand >= limite:
                blocages_24h += 1
except OSError:
    pass

json.dump({
    "genere_epoch": int(time.time()),
    "temperature_c": reel("temperature"),
    "throttled": brut or None,
    "sous_tension_maintenant": bit(0),
    "bridage_thermique_maintenant": bit(3),
    "sous_tension_deja": bit(16),
    "bridage_thermique_deja": bit(19),
    "calages_demarrage": entier("calages_boot", 0),
    "calages_24h": entier("calages_24h"),
    "calages_7j": entier("calages_7j"),
    "dernier_calage": texte("dernier_calage"),
    "taches_bloquees": entier("taches_bloquees", 0),
    "journal_depuis": texte("journal_depuis"),
    "journal_persistant": os.environ.get("journal_persistant") == "true",
    "ecrit_go": round(secteurs * 512 / 1073741824.0, 2) if secteurs else None,
    "uptime_s": entier("uptime_s"),
    "duree_dernier_s": duree_dernier,
    "duree_max_s": duree_max,
    "blocages_mesures_24h": blocages_24h,
    "mesure_durees_depuis": debut_mesure,
}, os.sys.stdout, ensure_ascii=False, indent=1)
PY

# Écriture atomique : l'assistant ne doit jamais lire un fichier à moitié
# écrit et conclure à une panne de mesure.
if [ -s "${SORTIE}.tmp" ] && python3 -c "import json,sys; json.load(open(sys.argv[1]))" "${SORTIE}.tmp"; then
    chmod 644 "${SORTIE}.tmp"
    mv -f "${SORTIE}.tmp" "$SORTIE"
else
    rm -f "${SORTIE}.tmp"
    echo "sd-health : JSON invalide, ancien fichier conservé" >&2
    exit 1
fi
