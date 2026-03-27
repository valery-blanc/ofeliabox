#!/bin/bash
# EduBox — Sauvegarde périodique (MariaDB + config)
# Exécuté toutes les 6 heures via systemd timer

set -euo pipefail

BACKUP_DIR="/var/backups/edubox"
DATE=$(date +%Y%m%d_%H%M)
ENV_FILE="/opt/edubox/.env"

# Charger les variables d'environnement
if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
fi

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Dump MariaDB
log "Dumping MariaDB..."
docker exec edubox-mariadb mysqldump \
    --all-databases \
    --single-transaction \
    --routines \
    --triggers \
    -u root -p"${MARIADB_ROOT_PASS}" \
    > "$BACKUP_DIR/mariadb_$DATE.sql"

gzip "$BACKUP_DIR/mariadb_$DATE.sql"
log "MariaDB dump: $BACKUP_DIR/mariadb_$DATE.sql.gz"

# Rotation : garder les 7 derniers backups
ls -tp "$BACKUP_DIR"/mariadb_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm --
log "Rotation done (kept last 7)"

log "Backup completed: $DATE"
