#!/usr/bin/env bash
# Régénère le certificat serveur Ofelia signé par la Root CA locale.
# Détecte les IPs courantes (eth0, wlan1, ZeroTier) et les inclut dans les SANs.
# La Root CA (ofelia-ca.crt) doit déjà exister — générée une seule fois par bootstrap.sh.
set -euo pipefail
SSL_DIR=/opt/edubox/ssl

if [ ! -f "$SSL_DIR/ofelia-ca.crt" ] || [ ! -f "$SSL_DIR/ofelia-ca.key" ]; then
  echo "ERREUR : Root CA absente dans $SSL_DIR. Lancer bootstrap.sh d'abord." >&2
  exit 1
fi

ETH_IP=$(ip -4 addr show eth0 2>/dev/null | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
WLAN1_IP=$(ip -4 addr show wlan1 2>/dev/null | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
ZT_IP=$(ip -4 addr 2>/dev/null | grep -B1 'scope global' | grep 'zt' | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
# Fallback ZeroTier : chercher une IP 10.x sur une interface zt*
if [ -z "$ZT_IP" ]; then
  ZT_IP=$(ip -4 addr 2>/dev/null | grep -A2 'zt' | grep -oP '(?<=inet )\d+\.\d+\.\d+\.\d+' | head -1 || true)
fi

SANS="DNS:ofelia,DNS:ofelia.local,DNS:canaima,DNS:libofelia,IP:127.0.0.1,IP:192.168.50.1"
[ -n "$ETH_IP"   ] && SANS="${SANS},IP:${ETH_IP}"
[ -n "$WLAN1_IP" ] && SANS="${SANS},IP:${WLAN1_IP}"
[ -n "$ZT_IP"    ] && SANS="${SANS},IP:${ZT_IP}"

echo "SANs : $SANS"

rm -f "$SSL_DIR/ofelia.key" "$SSL_DIR/ofelia.crt" /tmp/ofelia.csr /tmp/ofelia-ext.cnf
openssl genrsa -out "$SSL_DIR/ofelia.key" 2048 2>/dev/null
openssl req -new -key "$SSL_DIR/ofelia.key" \
  -subj "/CN=ofelia/O=Ofelia Box" \
  -out /tmp/ofelia.csr 2>/dev/null
printf "[ext]\nsubjectAltName=%s\n" "$SANS" > /tmp/ofelia-ext.cnf
openssl x509 -req -in /tmp/ofelia.csr \
  -CA "$SSL_DIR/ofelia-ca.crt" \
  -CAkey "$SSL_DIR/ofelia-ca.key" \
  -CAcreateserial \
  -out "$SSL_DIR/ofelia.crt" \
  -days 730 -sha256 \
  -extfile /tmp/ofelia-ext.cnf -extensions ext 2>/dev/null
chmod 600 "$SSL_DIR/ofelia.key"

echo "OK : certificat valide 2 ans — SANs: $SANS"
