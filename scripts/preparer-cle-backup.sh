#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
#  OFELIA BOX — PRÉPARER UNE CLÉ USB DE SAUVEGARDE
# ══════════════════════════════════════════════════════════════════════
#
#  À lancer quand on branche une clé USB neuve (ou de remplacement).
#  Elle sera formatée puis reconnue automatiquement à chaque démarrage.
#
#      sudo /opt/edubox/scripts/preparer-cle-backup.sh
#
#  ⚠ TOUT LE CONTENU DE LA CLÉ SERA EFFACÉ.
#
#  Le montage se fait par ÉTIQUETTE (OFELIA_BACKUP) et non par UUID :
#  n'importe quelle clé préparée par ce script fonctionne, sans avoir à
#  retoucher /etc/fstab. C'est ce qui permet de remplacer une clé morte
#  sur le terrain sans intervention technique.
#
# ══════════════════════════════════════════════════════════════════════

set -uo pipefail

LABEL=OFELIA_BACKUP
MOUNT=/mnt/backup

RED=$'\e[31m'; GREEN=$'\e[32m'; YEL=$'\e[33m'; BOLD=$'\e[1m'; OFF=$'\e[0m'
ok()   { echo "  ${GREEN}✓${OFF} $*"; }
warn() { echo "  ${YEL}!${OFF} $*"; }
die()  { echo "  ${RED}✗ $*${OFF}"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "À lancer avec sudo."

echo "╔══════════════════════════════════════════════════════════╗"
echo "║   Préparation d'une clé USB de sauvegarde — Ofelia Box    ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ── 1. Trouver les clés USB candidates ────────────────────────────────
# On ne considère que les disques amovibles : impossible de viser la
# carte SD du système par erreur.
echo
echo "${BOLD}Clés USB détectées :${OFF}"
mapfile -t CANDIDATES < <(
    lsblk -dno NAME,SIZE,TRAN,RM 2>/dev/null |
    awk '$3=="usb" && $4==1 {print $1" "$2}'
)

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
    echo
    die "Aucune clé USB détectée.
     Vérifie qu'elle est bien branchée, puis relance.
     Diagnostic : lsblk -o NAME,SIZE,TRAN,RM"
fi

i=1
for c in "${CANDIDATES[@]}"; do
    dev=${c%% *}; size=${c##* }
    model=$(cat "/sys/block/$dev/device/model" 2>/dev/null | xargs)
    echo "  [$i] /dev/$dev  —  $size  —  ${model:-modèle inconnu}"
    i=$((i + 1))
done

# ── 2. Choix ──────────────────────────────────────────────────────────
echo
if [ "${#CANDIDATES[@]}" -eq 1 ]; then
    CHOICE=1
    echo "Une seule clé détectée, elle sera utilisée."
else
    read -rp "Numéro de la clé à préparer [1-${#CANDIDATES[@]}] : " CHOICE
fi

case "$CHOICE" in
    ''|*[!0-9]*) die "Choix invalide." ;;
esac
[ "$CHOICE" -ge 1 ] && [ "$CHOICE" -le "${#CANDIDATES[@]}" ] || die "Choix hors liste."

SEL=${CANDIDATES[$((CHOICE - 1))]}
DEV="/dev/${SEL%% *}"
SIZE=${SEL##* }

# ── 3. Confirmation explicite ─────────────────────────────────────────
echo
echo "${BOLD}${YEL}⚠  TOUT le contenu de $DEV ($SIZE) va être EFFACÉ.${OFF}"
echo
echo "Contenu actuel :"
lsblk -o NAME,SIZE,FSTYPE,LABEL "$DEV" 2>/dev/null | sed 's/^/    /'
echo
read -rp "Taper OUI en majuscules pour confirmer : " CONFIRM
[ "$CONFIRM" = "OUI" ] || die "Annulé — rien n'a été modifié."

# ── 4. Formatage ──────────────────────────────────────────────────────
echo
echo "${BOLD}Préparation…${OFF}"

# Libérer la clé si un montage traîne
umount "${DEV}"* 2>/dev/null
systemctl stop mnt-backup.automount 2>/dev/null

wipefs -a "$DEV" >/dev/null 2>&1 || true
# Une seule partition sur toute la clé
parted -s "$DEV" mklabel gpt mkpart primary ext4 0% 100% >/dev/null 2>&1 \
    || die "Partitionnement impossible."
sleep 2
partprobe "$DEV" 2>/dev/null
sleep 2

PART="${DEV}1"
[ -b "$PART" ] || PART="${DEV}p1"
[ -b "$PART" ] || die "Partition introuvable après création."

# ext4 et non FAT : le scénario couvert est la coupure de courant, or FAT
# se corrompt facilement en écriture interrompue. -m 0 : pas de réserve
# root, c'est une clé de données.
mkfs.ext4 -F -m 0 -L "$LABEL" "$PART" >/dev/null 2>&1 \
    || die "Formatage ext4 impossible."
ok "Clé formatée en ext4, étiquette $LABEL"

# ── 5. Montage permanent, par étiquette ───────────────────────────────
mkdir -p "$MOUNT"

cp /etc/fstab "/etc/fstab.bak-$(date +%Y%m%d-%H%M%S)"
# Retirer toute ancienne ligne visant ce point de montage (UUID d'une clé
# précédente, éventuellement morte)
sed -i "\|[[:space:]]${MOUNT}[[:space:]]|d" /etc/fstab

# nofail            : la Box démarre même sans la clé
# x-systemd.automount : montée à la demande — sans ça, systemd libère le
#                       montage une fois le démarrage terminé
cat >> /etc/fstab <<EOF
LABEL=$LABEL  $MOUNT  ext4  defaults,noatime,nofail,x-systemd.automount,x-systemd.device-timeout=15,x-systemd.idle-timeout=0  0  2
EOF

systemctl daemon-reload
systemctl start mnt-backup.automount 2>/dev/null
sleep 2
ls "$MOUNT" >/dev/null 2>&1 || true

findmnt -n -t ext4 "$MOUNT" >/dev/null 2>&1 \
    || die "La clé ne s'est pas montée. Diagnostic : findmnt $MOUNT"
ok "Montage automatique configuré (par étiquette, pas par UUID)"

mkdir -p "$MOUNT/ofelia"
chown -R ofelia:ofelia "$MOUNT/ofelia" 2>/dev/null

# ── 6. Copier le script de reprise sur la clé ─────────────────────────
if [ -f /opt/edubox/scripts/RESTAURER-OFELIA.sh ]; then
    cp /opt/edubox/scripts/RESTAURER-OFELIA.sh "$MOUNT/RESTAURER-OFELIA.sh"
    chmod +x "$MOUNT/RESTAURER-OFELIA.sh"
    ok "Script de reprise après sinistre copié sur la clé"
fi

# ── 7. Première sauvegarde immédiate ──────────────────────────────────
echo
echo "${BOLD}Première sauvegarde…${OFF}"
if /opt/edubox/scripts/backup-usb.sh 2>&1 | tail -8; then
    :
else
    warn "La sauvegarde a signalé une erreur — voir $MOUNT/ofelia/backup.log"
fi

echo
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                      CLÉ PRÊTE                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo
echo "  Sauvegarde automatique : toutes les nuits à 03h00"
echo "  Espace libre           : $(df -h "$MOUNT" | awk 'NR==2 {print $4}')"
echo
echo "  Cette clé est reconnue par son étiquette : une clé préparée par"
echo "  ce script est utilisable sur n'importe quelle Box Ofelia, et"
echo "  remplacer une clé morte ne demande plus aucune configuration."
echo
