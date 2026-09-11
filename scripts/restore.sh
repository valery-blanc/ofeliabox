#!/bin/bash
# EduBox — Restauration depuis un backup
# Usage: sudo bash restore.sh --from /var/backups/edubox --date 20260401_1200
#
# Restaure :
#   - Les bases de données MariaDB depuis le dump SQL
#   - Les données applicatives depuis l'archive tar
#   - Kolibri optionnel via --with-kolibri

set -euo pipefail

EDUBOX_DIR="/opt/edubox"
DATA_DIR="$EDUBOX_DIR/data"
BACKUP_DIR="/var/backups/edubox"
BACKUP_DATE=""
WITH_KOLIBRI=false

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "${RED}[ERREUR]${NC} $*"; exit 1; }
confirm() {
    read -rp "$(echo -e "${YELLOW}$* [oui/non]${NC} ")" ans
    [[ "$ans" == "oui" ]] || die "Restauration annulée."
}

# ─── Arguments ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --from)    BACKUP_DIR="$2"; shift 2 ;;
        --date)    BACKUP_DATE="$2"; shift 2 ;;
        --with-kolibri) WITH_KOLIBRI=true; shift ;;
        *) die "Argument inconnu : $1" ;;
    esac
done

[ "$(id -u)" -eq 0 ] || die "Ce script doit être lancé en root"

ENV_FILE="$EDUBOX_DIR/.env"
[ -f "$ENV_FILE" ] || die ".env introuvable : $ENV_FILE"
set -a; source "$ENV_FILE"; set +a

# ─── Sélection du backup ──────────────────────────────────────────────────────
if [ -z "$BACKUP_DATE" ]; then
    log "Backups disponibles :"
    ls -1t "$BACKUP_DIR"/mariadb_*.sql.gz 2>/dev/null | head -10 | \
        sed 's|.*/mariadb_||;s|\.sql\.gz||'
    read -rp "Entrez la date du backup (ex: 20260401_1200) : " BACKUP_DATE
fi

SQL_FILE="$BACKUP_DIR/mariadb_${BACKUP_DATE}.sql.gz"
APP_FILE="$BACKUP_DIR/appdata_${BACKUP_DATE}.tar.gz"
KOLIBRI_FILE="$BACKUP_DIR/kolibri_${BACKUP_DATE}.tar.gz"

[ -f "$SQL_FILE" ] || die "Backup SQL introuvable : $SQL_FILE"
[ -f "$APP_FILE" ] || die "Backup appdata introuvable : $APP_FILE"

log "=== EduBox Restore — backup du $BACKUP_DATE ==="
log "SQL     : $SQL_FILE ($(du -sh "$SQL_FILE" | cut -f1))"
log "Appdata : $APP_FILE ($(du -sh "$APP_FILE" | cut -f1))"
[ "$WITH_KOLIBRI" = "true" ] && log "Kolibri : $KOLIBRI_FILE"

echo ""
warn "ATTENTION : cette opération va ÉCRASER toutes les données actuelles !"
confirm "Confirmer la restauration ?"

# ─── 1. Arrêt du stack ────────────────────────────────────────────────────────
log "1/5 Arrêt du stack..."
cd "$EDUBOX_DIR"
docker compose down

# ─── 2. Restauration données applicatives ────────────────────────────────────
log "2/5 Restauration données applicatives..."
# Vider les répertoires cibles (sauf kolibri).
# ⚠️ bibliofelia/ et mariadb/ manquaient à cette liste. Sans purge, tout fichier
# créé APRÈS la date du backup survivait à la restauration et se mélangeait aux
# fichiers restaurés — une remise en état censée ramener la Box à T0 la laissait
# dans un état mi-T0 mi-maintenant, en affichant « Restauration terminée ».
# Pour BibliOfelia c'était le pire cas : la base de T0 réinstallée à côté d'un
# journal -wal de maintenant, que SQLite rejoue par-dessus à la réouverture.
for dir in moodle/data moodle/html koha/data koha/config digistorm \
           pmb/data pmb/config slims/data slims/config portainer \
           bibliofelia/media; do
    rm -rf "${DATA_DIR:?}/$dir"
    mkdir -p "$DATA_DIR/$dir"
done

# Les deux répertoires qui portent des données irremplaçables sont MIS DE CÔTÉ,
# pas supprimés : si la restauration échoue en cours de route (archive tronquée,
# dump SQL illisible), l'opérateur d'un site distant doit pouvoir revenir en
# arrière. Ils sont à effacer à la main une fois la Box vérifiée.
ASIDE="before-restore-$(date +%Y%m%d_%H%M%S)"
for dir in bibliofelia/data mariadb; do
    if [ -d "${DATA_DIR:?}/$dir" ]; then
        mv "$DATA_DIR/$dir" "$DATA_DIR/$dir.$ASIDE"
        warn "Ancien $dir conservé dans $DATA_DIR/$dir.$ASIDE"
    fi
    mkdir -p "$DATA_DIR/$dir"
done

tar -xzf "$APP_FILE" -C "$DATA_DIR"
log "Appdata restauré"

# BibliOfelia : l'archive ne contient pas la base vivante mais l'instantané
# cohérent pris par backup.sh. On le remet en place sous son vrai nom.
BIBLIO_DATA="$DATA_DIR/bibliofelia/data"
if [ -f "$BIBLIO_DATA/bibliofelia-snapshot.sqlite3" ]; then
    mv -f "$BIBLIO_DATA/bibliofelia-snapshot.sqlite3" "$BIBLIO_DATA/bibliofelia.sqlite3"
    rm -f "$BIBLIO_DATA/bibliofelia.sqlite3-wal" "$BIBLIO_DATA/bibliofelia.sqlite3-shm"
    log "BibliOfelia : base restaurée depuis l'instantané"
else
    warn "BibliOfelia : aucun instantané dans l'archive — base NON restaurée"
    warn "  (backup pris avant le correctif, ou conteneur arrêté ce jour-là)"
fi

# Réappliquer les permissions.
# MariaDB repart d'un datadir VIDE : son datadir n'est plus archivé (une copie à
# chaud d'InnoDB n'est pas restaurable), c'est le dump SQL de l'étape 4 qui fait
# foi. L'image réinitialise le datadir au démarrage, puis on charge le dump.
chown -R 999:999 "$DATA_DIR/mariadb" 2>/dev/null || true
chmod 750 "$DATA_DIR/mariadb" 2>/dev/null || true
chown -R 82:82 "$DATA_DIR/moodle/data" "$DATA_DIR/moodle/html"
chmod 750 "$DATA_DIR/moodle/data" "$DATA_DIR/moodle/html"
chown -R 33:33 "$DATA_DIR/pmb/data" "$DATA_DIR/pmb/config"
chown -R 33:33 "$DATA_DIR/slims/data" "$DATA_DIR/slims/config"
chmod 777 "$DATA_DIR/kolibri"

# ─── 3. Démarrer MariaDB seul ─────────────────────────────────────────────────
log "3/5 Démarrage MariaDB..."
docker compose up -d mariadb
log "Attente MariaDB (60s)..."
sleep 60

# Vérifier que MariaDB est healthy
RETRIES=10
until docker exec edubox-mariadb healthcheck.sh --connect --innodb_initialized &>/dev/null; do
    RETRIES=$((RETRIES-1))
    [ $RETRIES -le 0 ] && die "MariaDB ne démarre pas — vérifiez les logs"
    log "MariaDB pas encore prêt, attente 10s... ($RETRIES essais)"
    sleep 10
done
log "MariaDB healthy"

# ─── 4. Restauration SQL ──────────────────────────────────────────────────────
log "4/5 Restauration des bases de données..."
zcat "$SQL_FILE" | docker exec -i edubox-mariadb mysql -u root -p"${MARIADB_ROOT_PASS}"
log "Bases de données restaurées"

# ─── 4 bis. Recréer le compte de contrôle de santé ────────────────────────────
# `--all-databases` restaure aussi la table `mysql.user`, donc les mots de passe
# du jour du backup — et surtout, il EFFACE le compte `healthcheck` que l'image
# MariaDB crée à sa première initialisation. La base fonctionne parfaitement,
# mais son healthcheck Docker échoue en boucle, le conteneur reste `unhealthy`,
# et Moodle — qui l'attend par `depends_on: condition: service_healthy` — ne
# démarre jamais. Constaté le 2026-08-26 en remontant la Box sur carte neuve :
# une panne dont la cause est à trois niveaux d'indirection de son symptôme.
#
# Le mot de passe attendu est celui que l'image a écrit dans son propre fichier
# de configuration ; on le relit plutôt que de le deviner.
log "4bis/5 Recréation du compte healthcheck MariaDB..."
HC_PASS=$(docker exec edubox-mariadb sh -c \
    "grep -h '^password' /var/lib/mysql/.my-healthcheck.cnf 2>/dev/null | head -1 | cut -d= -f2-" \
    | tr -d ' "'"'"'' || true)

if [ -n "$HC_PASS" ]; then
    docker exec -i edubox-mariadb mysql -u root -p"${MARIADB_ROOT_PASS}" <<SQL && \
        log "Compte healthcheck rétabli" || warn "Recréation du compte healthcheck ÉCHOUÉE"
CREATE USER IF NOT EXISTS 'healthcheck'@'localhost' IDENTIFIED BY '${HC_PASS}';
ALTER USER 'healthcheck'@'localhost' IDENTIFIED BY '${HC_PASS}';
CREATE USER IF NOT EXISTS 'healthcheck'@'127.0.0.1' IDENTIFIED BY '${HC_PASS}';
ALTER USER 'healthcheck'@'127.0.0.1' IDENTIFIED BY '${HC_PASS}';
CREATE USER IF NOT EXISTS 'healthcheck'@'::1' IDENTIFIED BY '${HC_PASS}';
ALTER USER 'healthcheck'@'::1' IDENTIFIED BY '${HC_PASS}';
FLUSH PRIVILEGES;
SQL
else
    warn "Fichier .my-healthcheck.cnf introuvable — compte healthcheck non rétabli."
    warn "  MariaDB restera 'unhealthy' et Moodle ne démarrera pas."
fi

# Vérification : le healthcheck de l'image doit répondre avant qu'on aille plus
# loin. Sans ce contrôle, l'échec ne se voit qu'au démarrage de Moodle, plusieurs
# minutes et plusieurs étapes plus tard.
if docker exec edubox-mariadb healthcheck.sh --connect --innodb_initialized >/dev/null 2>&1; then
    log "Contrôle de santé MariaDB : OK"
else
    warn "Contrôle de santé MariaDB en échec APRÈS restauration — Moodle ne démarrera pas."
fi

# ─── 5. Restauration Kolibri (optionnel) ──────────────────────────────────────
if [ "$WITH_KOLIBRI" = "true" ]; then
    [ -f "$KOLIBRI_FILE" ] || die "Backup Kolibri introuvable : $KOLIBRI_FILE"
    log "5/5 Restauration Kolibri (peut prendre 30-60 min)..."
    rm -rf "${DATA_DIR:?}/kolibri"
    mkdir -p "$DATA_DIR/kolibri"
    chmod 777 "$DATA_DIR/kolibri"
    tar -xzf "$KOLIBRI_FILE" -C "$DATA_DIR/kolibri"
    log "Kolibri restauré"
else
    log "5/5 Kolibri ignoré (utiliser --with-kolibri pour le restaurer)"
fi

# ─── Démarrage complet ────────────────────────────────────────────────────────
log "Démarrage du stack complet..."
docker compose up -d
sleep 30
docker compose ps --format "table {{.Name}}\t{{.Status}}"

log "=== Restauration terminée ==="
echo ""
warn "À vérifier avant de considérer la Box remise en état :"
warn "  1. Les mots de passe sont ceux du jour du backup, pas ceux de .env :"
warn "     le dump SQL restaure aussi la table mysql.user. Si MariaDB reste"
warn "     'unhealthy', c'est son compte healthcheck qui a disparu avec — le"
warn "     recréer avec le mot de passe de /var/lib/mysql/.my-healthcheck.cnf."
warn "  2. BibliOfelia : ouvrir /bibliofelia/ et vérifier prêts et caisse."
warn "  3. Une fois tout vérifié, effacer les copies de sécurité :"
warn "     rm -rf $DATA_DIR/*.before-restore-*"
