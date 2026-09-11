#!/bin/bash
# EduBox — Script d'installation complète sur Raspberry Pi 5
# Usage: sudo bash install.sh
#
# Ce script installe Docker, clone le repo, crée les répertoires de données
# et démarre le stack EduBox sur un Pi neuf (Raspberry Pi OS Bookworm 64-bit).

set -euo pipefail

EDUBOX_DIR="/opt/edubox"
DATA_DIR="$EDUBOX_DIR/data"
REPO_URL="${REPO_URL:-https://github.com/valery-blanc/ofeliabox.git}"
LOG_FILE="/tmp/edubox-install.log"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"; }
die()  { echo -e "${RED}[ERREUR]${NC} $*" | tee -a "$LOG_FILE"; exit 1; }

# ─── Vérifications préalables ─────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || die "Ce script doit être lancé en root (sudo bash install.sh)"
[ "$(uname -m)" = "aarch64" ] || warn "Architecture non-ARM64 détectée — le script est optimisé pour Pi 5"

log "=== EduBox — Installation ==="
log "Répertoire cible : $EDUBOX_DIR"

# ─── 1. Mise à jour système ───────────────────────────────────────────────────
log "1/7 Mise à jour des paquets..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Installation Docker ───────────────────────────────────────────────────
log "2/7 Installation de Docker..."
if command -v docker &>/dev/null; then
    log "Docker déjà installé ($(docker --version))"
else
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker "$(logname 2>/dev/null || echo pi)"
    log "Docker installé"
fi

# Docker Compose plugin
if ! docker compose version &>/dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi
log "Docker Compose : $(docker compose version --short)"

# ─── 3. Cloner le repo ────────────────────────────────────────────────────────
log "3/7 Déploiement des fichiers EduBox..."
if [ -d "$EDUBOX_DIR/.git" ]; then
    log "Repo déjà présent — git pull..."
    git -C "$EDUBOX_DIR" pull
else
    git clone "$REPO_URL" "$EDUBOX_DIR"
fi

# ─── 4. Fichier .env ──────────────────────────────────────────────────────────
log "4/7 Configuration des secrets..."

# Le .env est ÉCRIT, pas substitué dans un gabarit. L'ancienne version copiait
# .env.example puis remplaçait des marqueurs CHANGE_ME_* qui n'existaient pas
# dans le gabarit (il porte CHANGE_ME_root, CHANGE_ME_moodle, …) : les huit
# `sed` étaient des no-op silencieux. La Box démarrait avec les mots de passe
# publics du dépôt pendant que le script annonçait « mots de passe générés ».
# ⚠️ Cette liste de clés doit rester alignée sur `setup/app.py::_write_env`,
# qui est le chemin normal d'installation (assistant de premier démarrage).
gen() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-"${1:-20}"; }

if [ ! -f "$EDUBOX_DIR/.env" ]; then
    umask 077
    cat > "$EDUBOX_DIR/.env" <<EOF
# Généré par scripts/install.sh le $(date -Iseconds)
# Ne pas versionner. Pour changer un mot de passe applicatif, passer par la page
# des identifiants de l'assistant (POST /api/set-password) : elle le change DANS
# l'application, alors qu'éditer ce fichier ne changerait que l'affichage.
BOX_NAME=Ofelia
AP_PASS=$(gen 16)
CALIBRE_ADMIN_PASS=$(gen 16)
MARIADB_ROOT_PASS=$(gen 20)
MOODLE_DB_PASS=$(gen 20)
MOODLE_ADMIN_PASS=$(gen 16)
KOHA_DB_PASS=$(gen 20)
KOHA_ADMIN_PASS=$(gen 16)
SIP2_GATE_PASS=$(gen 16)
SIP2_SELFCHECK_PASS=$(gen 16)
REDIS_PASS=$(gen 20)
DIGISTORM_SESSION_KEY=$(gen 32)
PMB_DB_PASS=$(gen 20)
PMB_ADMIN_PASS=$(gen 16)
SLIMS_DB_PASS=$(gen 20)
SLIMS_ADMIN_PASS=$(gen 16)
BIBLIOFELIA_SECRET_KEY=$(gen 50)
EOF
    chmod 600 "$EDUBOX_DIR/.env"
    # Le contenu n'est PAS affiché : une installation se lance souvent sous
    # `tee`, dans une session SSH enregistrée ou depuis un wrapper qui journalise
    # — la sortie standard n'est pas un endroit où déposer tous les secrets de la
    # Box.
    warn ".env créé avec des mots de passe aléatoires (fichier en 600)."
    warn "Ils ne sont pas affichés ici. Pour les lire : sudo cat $EDUBOX_DIR/.env"
else
    log ".env existant conservé"
fi

# ─── 5. Répertoires de données (bind mounts) ──────────────────────────────────
log "5/7 Création des répertoires de données..."
mkdir -p "$DATA_DIR/mariadb"
mkdir -p "$DATA_DIR/moodle/data"
mkdir -p "$DATA_DIR/moodle/html"
mkdir -p "$DATA_DIR/kolibri"
mkdir -p "$DATA_DIR/koha/data"
mkdir -p "$DATA_DIR/koha/config"
mkdir -p "$DATA_DIR/digistorm"
mkdir -p "$DATA_DIR/pmb/data"
mkdir -p "$DATA_DIR/pmb/config"
mkdir -p "$DATA_DIR/slims/data"
mkdir -p "$DATA_DIR/slims/config"
mkdir -p "$DATA_DIR/portainer"

# Permissions : MariaDB uid 999
chown -R 999:999 "$DATA_DIR/mariadb"
chmod 750 "$DATA_DIR/mariadb"

# Permissions : Moodle www-data Alpine uid 82
chown -R 82:82 "$DATA_DIR/moodle/data" "$DATA_DIR/moodle/html"
chmod 750 "$DATA_DIR/moodle/data" "$DATA_DIR/moodle/html"

# Kolibri : root avec chmod 777 dans Dockerfile
chmod 777 "$DATA_DIR/kolibri"

# Koha : entrypoint gère les permissions au démarrage
chmod 755 "$DATA_DIR/koha/data" "$DATA_DIR/koha/config"

# PMB / SLiMS : www-data Debian uid 33
chown -R 33:33 "$DATA_DIR/pmb/data" "$DATA_DIR/pmb/config"
chown -R 33:33 "$DATA_DIR/slims/data" "$DATA_DIR/slims/config"
chmod 755 "$DATA_DIR/pmb/data" "$DATA_DIR/pmb/config"
chmod 755 "$DATA_DIR/slims/data" "$DATA_DIR/slims/config"

chmod 755 "$DATA_DIR/digistorm" "$DATA_DIR/portainer"

log "Répertoires créés"

# ─── 6. Démarrage du stack ────────────────────────────────────────────────────
log "6/7 Démarrage du stack Docker..."
cd "$EDUBOX_DIR"
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build

log "Stack démarré — attente initialisation (90s)..."
sleep 90

# ─── 7. Vérification ──────────────────────────────────────────────────────────
log "7/7 Vérification du statut..."
docker compose ps --format "table {{.Name}}\t{{.Status}}"

echo ""
log "=== Installation terminée ==="
log "Portail    : http://$(hostname -I | awk '{print $1}')/"
log "Moodle     : http://$(hostname -I | awk '{print $1}')/moodle"
log "Kolibri    : http://$(hostname -I | awk '{print $1}')/kolibri"
log "Koha       : http://$(hostname -I | awk '{print $1}')/biblio"
log "Wikipedia  : http://$(hostname -I | awk '{print $1}')/wiki"
log ""
log "Credentials Moodle admin : voir .env → MOODLE_ADMIN_PASS"
log "Log d'installation       : $LOG_FILE"
