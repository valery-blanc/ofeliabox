#!/bin/bash
# EduBox — Sauvegarde périodique (MariaDB + données applicatives)
# Exécuté toutes les 6 heures via systemd timer
# Pour un backup complet (avec Kolibri) : bash backup.sh --with-kolibri

set -euo pipefail

EDUBOX_DIR="/opt/edubox"
DATA_DIR="$EDUBOX_DIR/data"
BACKUP_DIR="/var/backups/edubox"
DATE=$(date +%Y%m%d_%H%M)
ENV_FILE="$EDUBOX_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
fi

mkdir -p "$BACKUP_DIR"

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
warn() { echo "[$(date '+%H:%M:%S')] [WARN] $*"; }

# Dump MariaDB
log "Dump MariaDB..."
docker exec edubox-mariadb mysqldump \
    --all-databases \
    --single-transaction \
    --routines \
    --triggers \
    -u root -p"${MARIADB_ROOT_PASS}" \
    | gzip > "$BACKUP_DIR/mariadb_$DATE.sql.gz"
log "MariaDB : $BACKUP_DIR/mariadb_$DATE.sql.gz"

# Instantané cohérent de la base BibliOfelia — cf. scripts/backup.sh pour le
# détail : un tar de la base vivante (+ ses journaux -wal / -shm) produit une
# archive déchirée, qui se restaure en base corrompue ou amputée des dernières
# écritures.
log "Instantané BibliOfelia..."
if docker exec edubox-bibliofelia test -f /app/data/bibliofelia.sqlite3 2>/dev/null; then
    if docker exec edubox-bibliofelia sqlite3 /app/data/bibliofelia.sqlite3 \
            ".backup '/app/data/bibliofelia-snapshot.sqlite3'" 2>/dev/null; then
        log "BibliOfelia : instantané créé"
    else
        warn "BibliOfelia : instantané IMPOSSIBLE — la base ne sera pas sauvegardée"
    fi
else
    warn "BibliOfelia : conteneur arrêté ou base absente — rien à sauvegarder"
fi

# Archive données applicatives.
# ⚠️ Les motifs --exclude portent sur le nom DANS l'archive (./kolibri/…), pas
# sur un chemin absolu : `--exclude="$DATA_DIR/kolibri"` n'excluait rien et cette
# sauvegarde « hors Kolibri », lancée toutes les 6 h par le timer systemd,
# archivait en fait des dizaines de Go sur la carte SD.
# MariaDB est exclue : son dump SQL ci-dessus en est la sauvegarde.
log "Archive appdata (hors Kolibri, MariaDB et base vivante)..."
tar -czf "$BACKUP_DIR/appdata_$DATE.tar.gz" \
    --exclude=./kolibri \
    --exclude=./mariadb \
    --exclude=./bibliofelia/data/bibliofelia.sqlite3 \
    --exclude=./bibliofelia/data/bibliofelia.sqlite3-wal \
    --exclude=./bibliofelia/data/bibliofelia.sqlite3-shm \
    -C "$DATA_DIR" .
log "Appdata : $BACKUP_DIR/appdata_$DATE.tar.gz"

# Rotation : garder les 7 derniers backups
ls -tp "$BACKUP_DIR"/mariadb_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm --
ls -tp "$BACKUP_DIR"/appdata_*.tar.gz 2>/dev/null  | tail -n +8 | xargs -r rm --
log "Rotation done (kept last 7)"

log "Backup terminé : $DATE"
