#!/usr/bin/env bash
# bootstrap.sh — Installation initiale Ofelia sur un Pi vierge
# Usage : curl -sSL https://raw.githubusercontent.com/valery-blanc/ofeliabox/main/bootstrap.sh | sudo bash
set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[Ofelia]${NC} $*"; }
info() { echo -e "${BLUE}[Ofelia]${NC} $*"; }
warn() { echo -e "${YELLOW}[Ofelia]${NC} $*"; }

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║          Ofelia Box — Bootstrap                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Dépendances système ──────────────────────────────────────────────────
log "[1/5] Mise à jour du système et installation des dépendances..."
apt-get update -qq
apt-get install -y -qq git curl python3 python3-flask

# ── 2. Docker ──────────────────────────────────────────────────────────────
log "[2/5] Installation de Docker..."
if command -v docker &>/dev/null; then
  info "  Docker déjà installé ($(docker --version | cut -d' ' -f3 | tr -d ','))"
else
  curl -fsSL https://get.docker.com | sh
  INSTALL_USER="${SUDO_USER:-${USER:-pi}}"
  usermod -aG docker "$INSTALL_USER" 2>/dev/null || true
  info "  Docker installé. L'utilisateur $INSTALL_USER a été ajouté au groupe docker."
fi

# ── 3. Clonage du dépôt ────────────────────────────────────────────────────
log "[3/5] Clonage du dépôt Ofelia..."
if [ -d /opt/edubox/.git ]; then
  info "  Dépôt déjà présent — mise à jour..."
  git -C /opt/edubox pull --ff-only
else
  git clone https://github.com/valery-blanc/ofeliabox /opt/edubox
fi

# ── 4. Dépendances Python du wizard (déjà installé via apt à l'étape 1) ──
log "[4/5] Vérification de Flask..."
python3 -c "import flask" 2>/dev/null || apt-get install -y -qq python3-flask

# ── 5. Démarrage du wizard ────────────────────────────────────────────────
log "[5/5] Démarrage du wizard d'installation..."

# Arrêter un éventuel wizard déjà en cours
pkill -f "python3.*setup/app.py" 2>/dev/null || true
sleep 1

nohup python3 /opt/edubox/setup/app.py > /tmp/ofelia-setup.log 2>&1 &
WIZARD_PID=$!
sleep 2

if ! kill -0 "$WIZARD_PID" 2>/dev/null; then
  warn "Le wizard n'a pas pu démarrer. Logs :"
  tail -20 /tmp/ofelia-setup.log
  exit 1
fi

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║      ✅  Ofelia Setup Wizard est prêt !          ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
printf  "║  Ouvre dans ton navigateur :                     ║\n"
printf  "║  ${BLUE}http://%-40s${NC}║\n" "$IP:8080/"
echo "║                                                  ║"
echo "║  Logs du wizard :                                ║"
echo "║  tail -f /tmp/ofelia-setup.log                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
