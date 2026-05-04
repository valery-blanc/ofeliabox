#!/usr/bin/env bash
# bootstrap.sh — Installation initiale Ofelia sur un Pi vierge
# Usage : curl -sSL https://raw.githubusercontent.com/valery-blanc/ofeliabox/main/bootstrap.sh | sudo bash
set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[Ofelia]${NC} $*"; }
info() { echo -e "${BLUE}[Ofelia]${NC} $*"; }
warn() { echo -e "${YELLOW}[Ofelia]${NC} $*"; }

ZEROTIER_NETWORK="f3797ba7a8e6a4b5"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║          Ofelia Box — Bootstrap                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Dépendances système ──────────────────────────────────────────────────
log "[1/6] Mise à jour du système et installation des dépendances..."
apt-get update -qq
apt-get install -y -qq git curl python3 python3-flask openssl

# ── 2. Docker ──────────────────────────────────────────────────────────────
log "[2/6] Installation de Docker..."
if command -v docker &>/dev/null; then
  info "  Docker déjà installé ($(docker --version | cut -d' ' -f3 | tr -d ','))"
else
  curl -fsSL https://get.docker.com | sh
  INSTALL_USER="${SUDO_USER:-${USER:-pi}}"
  usermod -aG docker "$INSTALL_USER" 2>/dev/null || true
  info "  Docker installé. L'utilisateur $INSTALL_USER a été ajouté au groupe docker."
fi

# ── 3. Clonage du dépôt ────────────────────────────────────────────────────
log "[3/6] Clonage du dépôt Ofelia..."
if [ -d /opt/edubox/.git ]; then
  info "  Dépôt déjà présent — mise à jour..."
  git -C /opt/edubox pull --ff-only
else
  git clone https://github.com/valery-blanc/ofeliabox /opt/edubox
fi

# ── 4. Dépendances Python du wizard ───────────────────────────────────────
log "[4/6] Vérification de Flask (installé via apt à l'étape 1)..."
python3 -c "import flask" || apt-get install -y -qq python3-flask

# ── 5. ZeroTier — accès distant ───────────────────────────────────────────
log "[5/7] Installation de ZeroTier (accès distant)..."
if command -v zerotier-cli &>/dev/null; then
  info "  ZeroTier déjà installé ($(zerotier-cli -v 2>/dev/null || echo 'version inconnue'))"
else
  curl -s https://install.zerotier.com | bash
  info "  ZeroTier installé"
fi

# TCP fallback relay — nécessaire derrière CGNAT/hotspot téléphone (double NAT).
# Sans cette config ZeroTier reste ONLINE mais ne peut pas établir de chemin
# vers les peers après ~2 min (le basculement relay peut prendre 3 min).
mkdir -p /var/lib/zerotier-one
cat > /var/lib/zerotier-one/local.conf <<'EOF'
{
  "settings": {
    "tcpFallbackRelay": true
  }
}
EOF
info "  ✓ TCP fallback relay activé (/var/lib/zerotier-one/local.conf)"

# Script NM dispatcher — redémarre ZeroTier quand eth0 tombe pour forcer
# la réinitialisation des chemins via wlan1 (hotspot maintenance).
mkdir -p /etc/NetworkManager/dispatcher.d
cat > /etc/NetworkManager/dispatcher.d/99-zerotier-restart <<'EOF'
#!/bin/bash
IFACE="$1"
EVENT="$2"
if [ "$IFACE" = "eth0" ] && [ "$EVENT" = "down" ]; then
    sleep 3
    systemctl restart zerotier-one
fi
EOF
chmod +x /etc/NetworkManager/dispatcher.d/99-zerotier-restart
info "  ✓ Reconnexion automatique sur coupure Ethernet configurée"

systemctl restart zerotier-one
sleep 5
zerotier-cli join "$ZEROTIER_NETWORK" || warn "  join réseau ZeroTier échoué — à faire manuellement"

ZT_ADDR=$(zerotier-cli info 2>/dev/null | awk '{print $3}' || echo "inconnu")
info "  ✓ Adresse ZeroTier : ${BLUE}${ZT_ADDR}${NC}"
warn "  ➜ Autorise ce nœud sur https://my.zerotier.com (réseau ${ZEROTIER_NETWORK})"

# ── 6. Certificat SSL auto-signé ──────────────────────────────────────────
log "[6/7] Génération du certificat SSL..."
mkdir -p /opt/edubox/ssl
if [ ! -f /opt/edubox/ssl/ofelia.crt ]; then
  openssl req -x509 -newkey rsa:2048 \
    -keyout /opt/edubox/ssl/ofelia.key \
    -out    /opt/edubox/ssl/ofelia.crt \
    -days 3650 -nodes \
    -subj "/CN=ofelia/O=Ofelia Box" \
    -addext "subjectAltName=DNS:ofelia,DNS:ofelia.local,IP:192.168.50.1,IP:127.0.0.1" \
    2>/dev/null
  chmod 600 /opt/edubox/ssl/ofelia.key
  log "  ✓ Certificat SSL généré dans /opt/edubox/ssl/"
  info "  Pour éviter l'alerte navigateur, télécharge le certificat CA :"
  info "  http://192.168.50.1/assets/ofelia-ca.crt  (si Root CA disponible)"
else
  info "  Certificat SSL existant conservé"
fi

# ── 7. Démarrage du wizard ────────────────────────────────────────────────
log "[7/7] Démarrage du wizard d'installation..."

docker compose -f /opt/edubox/docker-compose.yml up -d --build setup
sleep 3

if ! docker ps --filter name=edubox-setup --filter status=running -q | grep -q .; then
  warn "Le wizard n'a pas pu démarrer. Logs :"
  docker logs edubox-setup --tail 20
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
