#!/bin/bash
# EduBox — Sauvegarde complète (BDD + données applicatives)
# Usage: sudo bash backup.sh [--dest /chemin/backup]
#
# Sauvegarde :
#   - Dump SQL MariaDB (toutes les BDD)
#   - Archive tar des données applicatives (hors Kolibri, trop volumineux)
#   - Kolibri optionnel via --with-kolibri

set -euo pipefail

EDUBOX_DIR="/opt/edubox"
DATA_DIR="$EDUBOX_DIR/data"
BACKUP_DIR="/var/backups/edubox"
DATE=$(date +%Y%m%d_%H%M)
WITH_KOLIBRI=false
KEEP_DAYS=7

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[ERREUR]${NC} $*"; exit 1; }

# ─── Arguments ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --dest)      BACKUP_DIR="$2"; shift 2 ;;
        --with-kolibri) WITH_KOLIBRI=true; shift ;;
        --keep)      KEEP_DAYS="$2"; shift 2 ;;
        *) die "Argument inconnu : $1" ;;
    esac
done

[ "$(id -u)" -eq 0 ] || die "Ce script doit être lancé en root"
mkdir -p "$BACKUP_DIR"

ENV_FILE="$EDUBOX_DIR/.env"
[ -f "$ENV_FILE" ] || die ".env introuvable : $ENV_FILE"
set -a; source "$ENV_FILE"; set +a

log "=== EduBox Backup — $DATE ==="
log "Destination : $BACKUP_DIR"

# ─── 1. Dump MariaDB ──────────────────────────────────────────────────────────
log "1/3 Dump MariaDB (toutes les BDD)..."
docker exec edubox-mariadb mysqldump \
    --all-databases \
    --single-transaction \
    --routines \
    --triggers \
    -u root -p"${MARIADB_ROOT_PASS}" \
    | gzip > "$BACKUP_DIR/mariadb_${DATE}.sql.gz"
log "SQL : $BACKUP_DIR/mariadb_${DATE}.sql.gz ($(du -sh "$BACKUP_DIR/mariadb_${DATE}.sql.gz" | cut -f1))"

# ─── 2. Instantané cohérent de la base BibliOfelia ────────────────────────────
# tar lit chaque fichier à un instant différent. Archiver bibliofelia.sqlite3 et
# ses journaux -wal / -shm pendant que gunicorn et le worker écrivent produit une
# archive déchirée : au mieux elle se restaure en perdant des prêts et des
# paiements, au pire SQLite répond « database disk image is malformed » et le
# conteneur redémarre en boucle. On demande donc à SQLite une copie cohérente
# (même mécanisme que `apps/tasks/backup.py`), et on exclut les fichiers vivants.
log "2/4 Instantané cohérent de la base BibliOfelia..."
BIBLIO_SNAPSHOT="/app/data/bibliofelia-snapshot.sqlite3"
if docker exec edubox-bibliofelia test -f /app/data/bibliofelia.sqlite3 2>/dev/null; then
    if docker exec edubox-bibliofelia sqlite3 /app/data/bibliofelia.sqlite3 \
            ".backup '$BIBLIO_SNAPSHOT'" 2>/dev/null; then
        log "BibliOfelia : instantané créé"
    else
        warn "BibliOfelia : instantané IMPOSSIBLE — la base ne sera pas sauvegardée"
    fi
else
    warn "BibliOfelia : conteneur arrêté ou base absente — rien à sauvegarder"
fi

# ─── 3. Archive données applicatives ──────────────────────────────────────────
# ⚠️ Les motifs --exclude sont comparés au nom du fichier DANS l'archive
# (./kolibri/…), pas à son chemin absolu : `--exclude="$DATA_DIR/kolibri"`
# n'excluait rien du tout et l'archive « hors Kolibri » embarquait ses dizaines
# de gigaoctets, toutes les six heures, sur la carte SD.
# Le datadir MariaDB est exclu lui aussi : le dump SQL de l'étape 1 en est la
# vraie sauvegarde, et une copie à chaud d'un datadir InnoDB n'est pas
# restaurable.
log "3/4 Archive données applicatives (hors Kolibri, MariaDB et base vivante)..."
tar -czf "$BACKUP_DIR/appdata_${DATE}.tar.gz" \
    --exclude=./kolibri \
    --exclude=./mariadb \
    --exclude=./bibliofelia/data/bibliofelia.sqlite3 \
    --exclude=./bibliofelia/data/bibliofelia.sqlite3-wal \
    --exclude=./bibliofelia/data/bibliofelia.sqlite3-shm \
    -C "$DATA_DIR" .
log "Appdata : $BACKUP_DIR/appdata_${DATE}.tar.gz ($(du -sh "$BACKUP_DIR/appdata_${DATE}.tar.gz" | cut -f1))"

# ─── 4. Kolibri (optionnel — 50+ Go) ──────────────────────────────────────────
if [ "$WITH_KOLIBRI" = "true" ]; then
    log "4/4 Archive Kolibri (peut prendre 30-60 min)..."
    tar -czf "$BACKUP_DIR/kolibri_${DATE}.tar.gz" \
        -C "$DATA_DIR/kolibri" .
    log "Kolibri : $BACKUP_DIR/kolibri_${DATE}.tar.gz ($(du -sh "$BACKUP_DIR/kolibri_${DATE}.tar.gz" | cut -f1))"
else
    log "4/4 Kolibri ignoré (utiliser --with-kolibri pour l'inclure)"
fi

# ─── Rotation ─────────────────────────────────────────────────────────────────
log "Rotation : conservation des $KEEP_DAYS derniers backups..."
ls -tp "$BACKUP_DIR"/mariadb_*.sql.gz 2>/dev/null   | tail -n +"$((KEEP_DAYS+1))" | xargs -r rm --
ls -tp "$BACKUP_DIR"/appdata_*.tar.gz 2>/dev/null   | tail -n +"$((KEEP_DAYS+1))" | xargs -r rm --
ls -tp "$BACKUP_DIR"/kolibri_*.tar.gz 2>/dev/null   | tail -n +"$((KEEP_DAYS+1))" | xargs -r rm --

log "=== Backup terminé — $DATE ==="
du -sh "$BACKUP_DIR"
