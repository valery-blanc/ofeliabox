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
apt-get install -y -qq git curl python3 python3-flask openssl avahi-daemon avahi-utils

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

# ── 6. Root CA + certificat serveur SSL ───────────────────────────────────
log "[6/7] Génération Root CA + certificat SSL..."
mkdir -p /opt/edubox/ssl
chmod +x /opt/edubox/scripts/regen-ssl.sh

# Root CA — générée une seule fois, validité 10 ans
if [ ! -f /opt/edubox/ssl/ofelia-ca.crt ]; then
  openssl genrsa -out /opt/edubox/ssl/ofelia-ca.key 2048 2>/dev/null
  openssl req -x509 -new -nodes \
    -key /opt/edubox/ssl/ofelia-ca.key -sha256 -days 3650 \
    -subj "/CN=Ofelia Box CA/O=Ofelia Box" \
    -out /opt/edubox/ssl/ofelia-ca.crt 2>/dev/null
  chmod 600 /opt/edubox/ssl/ofelia-ca.key
  log "  ✓ Root CA générée (/opt/edubox/ssl/ofelia-ca.crt)"
else
  info "  Root CA existante conservée"
fi

# Cert serveur signé par la CA — regénéré si absent (utiliser le bouton wizard pour forcer)
if [ ! -f /opt/edubox/ssl/ofelia.crt ]; then
  /opt/edubox/scripts/regen-ssl.sh
  log "  ✓ Certificat SSL généré"
else
  info "  Certificat SSL existant conservé"
fi
info "  Accès HTTPS (LAN/ZeroTier) : installer /assets/ofelia-ca.crt une seule fois sur vos appareils admin"
info "  Accès AP WiFi : HTTP uniquement (port 443 bloqué sur wlan0)"

# Règle iptables — HTTPS bloqué sur l'interface AP (wlan0) uniquement
# DOCKER-USER est la chaîne prévue pour les règles utilisateur (non écrasée par Docker)
# Implémentée via un service systemd qui s'exécute après docker.service au démarrage
log "  Configuration iptables : port 443 bloqué sur wlan0 (AP)..."
cat > /etc/systemd/system/ofelia-firewall.service <<'EOF'
[Unit]
Description=Ofelia — bloquer HTTPS sur l'interface AP (wlan0)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/sbin/iptables -I DOCKER-USER -i wlan0 -p tcp --dport 443 -j DROP
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable ofelia-firewall.service
# Appliquer immédiatement si DOCKER-USER existe déjà (Docker déjà démarré)
iptables -I DOCKER-USER -i wlan0 -p tcp --dport 443 -j DROP 2>/dev/null || true
log "  ✓ Règle iptables configurée (active au prochain démarrage + maintenant si Docker tourne)"

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
