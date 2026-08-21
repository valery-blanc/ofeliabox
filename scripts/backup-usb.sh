#!/bin/bash
# ── Ofelia Box — sauvegarde sur clé USB ───────────────────────────────
# Sauvegarde les données vivantes (bases, configs, médias) sur la clé USB
# montée en /mnt/backup. Les ZIM Kiwix sont volontairement exclus : 184 Go
# statiques qui ne changent jamais et ne tiendraient pas sur la clé.
#
# Lancement manuel :  sudo /opt/edubox/scripts/backup-usb.sh
# Automatique       :  ofelia-backup.timer (toutes les nuits à 03h00)

set -uo pipefail

EDUBOX_DIR=/opt/edubox
MOUNT=/mnt/backup
DEST_ROOT="$MOUNT/ofelia"
KEEP=14
STAMP=$(date '+%Y-%m-%d_%H%M')
DEST="$DEST_ROOT/$STAMP"
LOG="$DEST_ROOT/backup.log"

log() { echo "$(date '+%F %T')  $*" | tee -a "$LOG" 2>/dev/null || echo "$(date '+%F %T')  $*"; }

# ── 1. La clé est-elle là ? ───────────────────────────────────────────
# La Box démarre sans la clé (nofail) et /mnt/backup est un point
# d'automontage : y accéder déclenche le montage réel. Attention,
# `mountpoint` répondrait « oui » à cause de l'autofs même sans clé —
# d'où la vérification qu'un vrai système de fichiers ext4 est monté.
# Sans ce garde-fou, on écrirait sur la carte SD jusqu'à la remplir.
ls "$MOUNT" >/dev/null 2>&1 || true   # déclenche l'automontage
if ! findmnt -n -t ext4 "$MOUNT" >/dev/null 2>&1; then
    echo "$(date '+%F %T')  ERREUR : clé USB absente de $MOUNT — sauvegarde annulée." >&2
    exit 1
fi

mkdir -p "$DEST" || { echo "ERREUR : écriture impossible sur $DEST" >&2; exit 1; }
log "═══ Début sauvegarde → $DEST"

ERRORS=0
fail() { log "  ✗ ÉCHEC : $*"; ERRORS=$((ERRORS + 1)); }
ok()   { log "  ✓ $*"; }

# ── 2. Base BibliOfelia (SQLite en mode WAL) ──────────────────────────
# Une simple copie de fichier est DANGEREUSE en WAL : le -wal contient des
# transactions non encore fusionnées. On passe par l'API de sauvegarde en
# ligne de SQLite, qui produit un fichier cohérent même écriture en cours.
if docker ps --format '{{.Names}}' | grep -qx edubox-bibliofelia; then
    if docker exec edubox-bibliofelia python -c "
import sqlite3
src = sqlite3.connect('/app/data/bibliofelia.sqlite3')
dst = sqlite3.connect('/app/data/_backup_tmp.sqlite3')
with dst:
    src.backup(dst)
dst.close(); src.close()
" 2>>"$LOG"; then
        mv "$EDUBOX_DIR/data/bibliofelia/data/_backup_tmp.sqlite3" "$DEST/bibliofelia.sqlite3" \
            && gzip -9 "$DEST/bibliofelia.sqlite3" \
            && ok "BibliOfelia SQLite ($(du -h "$DEST/bibliofelia.sqlite3.gz" | cut -f1))"
    else
        fail "sauvegarde SQLite BibliOfelia"
    fi
else
    log "  – conteneur edubox-bibliofelia arrêté, base non sauvegardée"
fi

# ── 3. MariaDB (Moodle, et historiquement Koha/PMB/SLiMS) ─────────────
if docker ps --format '{{.Names}}' | grep -qx edubox-mariadb; then
    MARIADB_PASS=$(grep -E '^MARIADB_ROOT_PASS=' "$EDUBOX_DIR/.env" | cut -d= -f2-)
    # Le mot de passe passe par MYSQL_PWD et non par -p : en ligne de
    # commande il serait visible dans `ps` par tout utilisateur de la Box.
    if docker exec -e MYSQL_PWD="$MARIADB_PASS" edubox-mariadb mariadb-dump \
            --all-databases --single-transaction --quick --routines --events \
            -uroot 2>>"$LOG" | gzip -9 > "$DEST/mariadb-all.sql.gz"; then
        if [ -s "$DEST/mariadb-all.sql.gz" ]; then
            ok "MariaDB ($(du -h "$DEST/mariadb-all.sql.gz" | cut -f1))"
        else
            fail "dump MariaDB vide"
        fi
    else
        fail "dump MariaDB"
    fi
else
    log "  – conteneur edubox-mariadb arrêté, bases non sauvegardées"
fi

# ── 4. Médias BibliOfelia (couvertures, fichiers téléversés) ──────────
if tar -czf "$DEST/bibliofelia-media.tar.gz" \
        -C "$EDUBOX_DIR/data/bibliofelia" media 2>>"$LOG"; then
    ok "Médias BibliOfelia ($(du -h "$DEST/bibliofelia-media.tar.gz" | cut -f1))"
else
    fail "archive des médias"
fi

# ── 5. Configuration (ce qui permet de reconstruire la Box) ───────────
if tar -czf "$DEST/config.tar.gz" -C "$EDUBOX_DIR" \
        --exclude='*.bak' --exclude='*.bak-*' \
        docker-compose.yml .env nginx portal setup/app.py setup/templates \
        scripts ssl 2>>"$LOG"; then
    ok "Configuration ($(du -h "$DEST/config.tar.gz" | cut -f1))"
else
    fail "archive de configuration"
fi

# ── 5b. Réseau ZeroTier — identifiant SEULEMENT, jamais la clé privée ─
# On NE sauvegarde PAS identity.secret, volontairement.
# Cette clé privée EST l'identité de la Box : qui la détient peut démarrer
# zerotier-one ailleurs, se faire passer pour la Box auprès du contrôleur
# (membre déjà autorisé) et atteindre toutes les autres machines du réseau.
# Une clé USB de terrain est un support amovible : y déposer ce secret
# reviendrait à distribuer un laissez-passer réseau.
# Conséquence assumée : après réinstallation, le nouveau nœud doit être
# autorisé une fois dans ZeroTier Central. Un clic, contre un secret en
# moins dans la nature.
mkdir -p "$DEST/zerotier"
ls /var/lib/zerotier-one/networks.d/*.conf 2>/dev/null \
    | xargs -r -n1 basename 2>/dev/null | sed 's/\.conf$//' \
    > "$DEST/zerotier/networks.txt" 2>/dev/null
if [ -s "$DEST/zerotier/networks.txt" ]; then
    ok "Identifiant(s) de réseau ZeroTier (sans la clé privée)"
fi

# ── 6. Inventaire lisible (pour restaurer sans deviner) ───────────────
# Les bibliothèques hors-ligne (ZIM Kiwix, canaux Kolibri) ne sont PAS
# sauvegardées : plusieurs dizaines de Go de contenu statique et public.
# On enregistre leur liste — avec une connexion à 20 Mo/s, retélécharger
# est plus rapide que restaurer, et ça garde la clé légère.
{
    echo "Sauvegarde Ofelia Box — $STAMP"
    echo "Machine : $(hostname)  |  IP : $(hostname -I | awk '{print $1}')"
    echo
    echo "── Contenu de cette sauvegarde ──"
    echo "  bibliofelia.sqlite3.gz     base BibliOfelia (cohérente, API backup SQLite)"
    echo "  mariadb-all.sql.gz         toutes les bases MariaDB (dont Moodle)"
    echo "  bibliofelia-media.tar.gz   couvertures et fichiers téléversés"
    echo "  config.tar.gz              compose, .env, nginx, portail, setup, certificats"
    echo
    echo "── NON sauvegardé : à retélécharger lors d'une remise en route ──"
    echo "Fichiers ZIM Kiwix attendus dans /opt/edubox/kiwix/data/ :"
    if [ -d "$EDUBOX_DIR/kiwix/data" ]; then
        for z in "$EDUBOX_DIR"/kiwix/data/*.zim; do
            [ -e "$z" ] || continue
            echo "  $(basename "$z")  —  $(du -h "$z" | cut -f1)  —  https://download.kiwix.org/zim/"
        done
    fi
    echo
    echo "Canaux Kolibri installés :"
    if [ -d "$EDUBOX_DIR/data/kolibri/content/databases" ]; then
        for c in "$EDUBOX_DIR"/data/kolibri/content/databases/*.sqlite3; do
            [ -e "$c" ] || continue
            echo "  canal $(basename "$c" .sqlite3)"
        done
    else
        echo "  (aucun canal détecté)"
    fi
    echo
    echo "── Images Docker à reconstruire ──"
    docker images --format '  {{.Repository}}:{{.Tag}}' | grep -v '<none>' | sort -u
    echo
    echo "── Conteneurs au moment de la sauvegarde ──"
    docker ps -a --format '  {{.Names}}  {{.Status}}'
    echo
    echo "── Procédure de remise en route ──"
    echo "  1. Réinstaller Raspberry Pi OS et Docker sur une carte SD neuve"
    echo "  2. git clone https://github.com/valery-blanc/ofeliabox /opt/edubox"
    echo "  3. Décompresser config.tar.gz par-dessus (restaure .env et les certificats)"
    echo "  4. Restaurer les bases :"
    echo "       gunzip -c bibliofelia.sqlite3.gz > data/bibliofelia/data/bibliofelia.sqlite3"
    echo "       gunzip -c mariadb-all.sql.gz | docker exec -i edubox-mariadb mariadb -uroot -p<MARIADB_ROOT_PASS>"
    echo "  5. tar -xzf bibliofelia-media.tar.gz -C data/bibliofelia/"
    echo "  6. Retélécharger les ZIM listés ci-dessus dans kiwix/data/"
    echo "  7. docker compose up -d"
} > "$DEST/MANIFEST.txt" 2>/dev/null

# ── 7. Rotation ───────────────────────────────────────────────────────
cd "$DEST_ROOT" || exit 1
COUNT=$(find . -maxdepth 1 -type d -name '20*' | wc -l)
if [ "$COUNT" -gt "$KEEP" ]; then
    find . -maxdepth 1 -type d -name '20*' | sort | head -n -"$KEEP" | while read -r old; do
        rm -rf "$old" && log "  rotation : suppression de ${old#./}"
    done
fi

# ── 8. Écriture réellement sur la clé, pas dans le cache ──────────────
# Sans ce sync, une coupure juste après la sauvegarde laisserait une
# archive tronquée : exactement le scénario qu'on cherche à couvrir.
sync

TOTAL=$(du -sh "$DEST" 2>/dev/null | cut -f1)
FREE=$(df -h "$MOUNT" | awk 'NR==2 {print $4}')
if [ "$ERRORS" -eq 0 ]; then
    log "═══ Terminé — $TOTAL sauvegardés, $FREE libres, $(find "$DEST_ROOT" -maxdepth 1 -type d -name '20*' | wc -l) sauvegardes conservées"
else
    log "═══ Terminé AVEC $ERRORS ERREUR(S) — $TOTAL sauvegardés, $FREE libres"
fi
exit "$ERRORS"
