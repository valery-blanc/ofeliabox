#!/bin/bash
# ── Ofelia Box — durcissement du démarrage et de la journalisation ────
#
# Trois réglages qui vivent hors du dépôt, dans /etc, et qu'une
# réinstallation perdrait donc silencieusement. Ils sont nés de la panne du
# 2026-08-25 (BUG-038) :
#
#   1. /boot/firmware sans `nofail` pouvait faire basculer la Box en mode
#      urgence, où le compte root étant verrouillé, personne ne peut rien
#      faire — y compris sur place, écran branché.
#   2. Raspberry Pi OS garde les journaux en RAM. Les traces du démarrage
#      raté avaient disparu au redémarrage suivant, et la panne a dû être
#      reconstituée par inférence : une demi-journée pour une question à
#      laquelle un journal aurait répondu en dix secondes.
#   3. Docker n'a aucune limite de taille de journaux par défaut. 108 Mo
#      s'étaient accumulés, sans rotation, sur un site où personne ne
#      viendra faire le ménage.
#
# Idempotent : relancer ne fait rien de plus. Appelé par RESTAURER-OFELIA.sh,
# et exécutable seul :  sudo /opt/edubox/scripts/durcir-boot.sh

set -uo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Ce script doit être lancé en root." >&2; exit 1; }

EDUBOX_DIR="${EDUBOX_DIR:-/opt/edubox}"

GREEN=$'\e[32m'; YEL=$'\e[33m'; OFF=$'\e[0m'
ok()   { echo "  ${GREEN}✓${OFF} $*"; }
warn() { echo "  ${YEL}!${OFF} $*"; }

# ── 1. /boot/firmware ne doit jamais bloquer le démarrage ─────────────
if ! grep -qE '^[^#]*[[:space:]]/boot/firmware[[:space:]]' /etc/fstab 2>/dev/null; then
    warn "aucune ligne /boot/firmware dans /etc/fstab — rien à durcir"
elif grep -qE '^[^#]*[[:space:]]/boot/firmware[[:space:]].*\bnofail\b' /etc/fstab; then
    ok "nofail déjà présent sur /boot/firmware"
else
    cp /etc/fstab "/etc/fstab.avant-durcissement-$(date +%Y%m%d-%H%M%S)"
    # On ne touche QUE la ligne dont le point de montage est exactement
    # /boot/firmware, et seulement son champ d'options.
    awk 'BEGIN { OFS = "\t" }
         $2 == "/boot/firmware" && $0 !~ /^[[:space:]]*#/ && $4 !~ /nofail/ {
             $4 = $4 ",nofail"
         }
         { print }' /etc/fstab > /etc/fstab.nouveau
    if [ -s /etc/fstab.nouveau ] && grep -q '/boot/firmware' /etc/fstab.nouveau; then
        mv /etc/fstab.nouveau /etc/fstab
        ok "nofail ajouté sur /boot/firmware"
    else
        rm -f /etc/fstab.nouveau
        warn "résultat suspect — /etc/fstab laissé intact"
    fi
fi

# ── 2. Journaux persistants ───────────────────────────────────────────
# ⚠️ Modifier /etc/systemd/journald.conf NE SUFFIT PAS : Raspberry Pi OS
# livre /usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf, et un
# fichier .conf.d/ prime sur le fichier principal. Il faut une surcharge de
# rang supérieur — d'où le 50.
DROPIN=/etc/systemd/journald.conf.d/50-ofelia-persistant.conf
if [ -f "$DROPIN" ]; then
    ok "journaux persistants déjà configurés"
else
    mkdir -p /etc/systemd/journald.conf.d
    cat > "$DROPIN" <<'CONF'
# Ofelia — journaux persistants (BUG-038, FEAT-038).
#
# Raspberry Pi OS force Storage=volatile pour épargner la carte SD. Le choix
# se défend, mais il rend toute panne de démarrage inexplicable après coup.
# Le plafond compte autant que la persistance : sans lui, on remplacerait un
# problème par un autre.
[Journal]
Storage=persistent
SystemMaxUse=200M
CONF
    systemctl restart systemd-journald && journalctl --flush
    ok "journaux persistants activés (plafond 200 Mo)"
fi

# ── 3. Journaux Docker plafonnés ──────────────────────────────────────
# ⚠️ Ne s'applique qu'aux conteneurs RECRÉÉS : les conteneurs existants
# gardent leur configuration jusqu'à leur prochain `compose up`.
if [ -f /etc/docker/daemon.json ] && grep -q '"max-size"' /etc/docker/daemon.json; then
    ok "journaux Docker déjà plafonnés"
else
    mkdir -p /etc/docker
    [ -f /etc/docker/daemon.json ] && \
        cp /etc/docker/daemon.json "/etc/docker/daemon.json.avant-$(date +%Y%m%d-%H%M%S)"
    cat > /etc/docker/daemon.json.nouveau <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
JSON
    if python3 -c 'import json,sys; json.load(open(sys.argv[1]))' /etc/docker/daemon.json.nouveau 2>/dev/null; then
        mv /etc/docker/daemon.json.nouveau /etc/docker/daemon.json
        systemctl reload docker 2>/dev/null || true
        ok "journaux Docker plafonnés (3 × 10 Mo)"
    else
        rm -f /etc/docker/daemon.json.nouveau
        warn "JSON invalide — /etc/docker/daemon.json laissé intact"
    fi
fi

# ── 4. Économie d'énergie du point d'accès ────────────────────────────
# `brcmfmac` réactive l'économie d'énergie à CHAQUE montée de l'interface. Sur
# un point d'accès, la radio s'endort entre deux balises et les transferts se
# coupent en plein milieu — BUG-043, 42 secondes pour un logo de 86 Ko.
#
# Le script vit dans le dépôt ; sans cette copie, il n'était réinstallé par
# personne et le défaut serait revenu à la première reconstruction.
SRC_DISPATCH="$EDUBOX_DIR/network/dispatcher.d/90-ofelia-ap-powersave"
DST_DISPATCH=/etc/NetworkManager/dispatcher.d/90-ofelia-ap-powersave
if [ -f "$SRC_DISPATCH" ]; then
    mkdir -p /etc/NetworkManager/dispatcher.d
    # ⚠️ root:root et 755 obligatoires : NetworkManager ignore EN SILENCE un
    # script du répartiteur inscriptible par un autre que root.
    install -m 755 -o root -g root "$SRC_DISPATCH" "$DST_DISPATCH"
    ok "Économie d'énergie coupée sur le point d'accès (script installé)"
else
    warn "network/dispatcher.d/90-ofelia-ap-powersave absent du dépôt"
fi

# ── 5. Vérification ───────────────────────────────────────────────────
# Un fstab cassé produirait exactement la panne qu'on cherche à éliminer :
# on relit la configuration MAINTENANT plutôt qu'au prochain démarrage.
systemctl daemon-reload && ok "fstab relu sans erreur"
findmnt -n /boot/firmware >/dev/null 2>&1 \
    && ok "/boot/firmware montée" \
    || warn "/boot/firmware non montée — à vérifier"
