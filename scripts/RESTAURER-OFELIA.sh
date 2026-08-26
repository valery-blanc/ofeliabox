#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
#  OFELIA BOX — REMISE EN ROUTE APRÈS SINISTRE
# ══════════════════════════════════════════════════════════════════════
#
#  À utiliser quand la carte SD a lâché et qu'on repart de zéro.
#
#  CE QU'IL FAUT AVANT DE LANCER :
#    • Une Raspberry Pi OS fraîchement installée sur une carte SD neuve
#    • La Box branchée sur internet (câble ou Wi-Fi déjà configuré)
#    • Cette clé USB branchée
#
#  CE QUE FAIT CE SCRIPT :
#    1. Installe Docker et ZeroTier
#    2. Remet la Box sur le réseau ZeroTier (accès à distance)
#    3. Restaure la configuration et les données depuis la clé
#    4. Démarre le portail d'administration sur le port 8080
#
#  ENSUITE : tout le reste se fait à distance via le portail d'admin,
#  sans avoir besoin de quelqu'un devant la Box.
#
#  LANCEMENT :
#    sudo bash /media/*/RESTAURER-OFELIA.sh
#  ou, si la clé n'est pas montée automatiquement :
#    sudo mkdir -p /mnt/usb && sudo mount /dev/sda1 /mnt/usb
#    sudo bash /mnt/usb/RESTAURER-OFELIA.sh
#
# ══════════════════════════════════════════════════════════════════════

set -uo pipefail

EDUBOX_DIR=/opt/edubox
REPO=https://github.com/valery-blanc/ofeliabox
# Racine de la clé = dossier où se trouve ce script
USB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="$USB_ROOT/ofelia"

RED=$'\e[31m'; GREEN=$'\e[32m'; YEL=$'\e[33m'; BOLD=$'\e[1m'; OFF=$'\e[0m'
step()  { echo; echo "${BOLD}━━━ $* ${OFF}"; }
ok()    { echo "  ${GREEN}✓${OFF} $*"; }
warn()  { echo "  ${YEL}!${OFF} $*"; }
die()   { echo "  ${RED}✗ $*${OFF}"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "À lancer avec sudo."

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        OFELIA BOX — REMISE EN ROUTE APRÈS SINISTRE       ║"
echo "╚══════════════════════════════════════════════════════════╝"

# ── 0. Trouver la sauvegarde la plus récente ──────────────────────────
step "Recherche de la sauvegarde"
[ -d "$BACKUP_ROOT" ] || die "Aucun dossier 'ofelia' sur la clé ($BACKUP_ROOT). Mauvaise clé ?"
LAST=$(find "$BACKUP_ROOT" -maxdepth 1 -type d -name '20*' | sort | tail -1)
[ -n "$LAST" ] || die "Aucune sauvegarde datée dans $BACKUP_ROOT."
ok "Sauvegarde retenue : $(basename "$LAST")"
[ -f "$LAST/MANIFEST.txt" ] && grep -E '^  (bibliofelia|mariadb|config)' "$LAST/MANIFEST.txt" | sed 's/^/    /'

echo
read -rp "Continuer avec cette sauvegarde ? [O/n] " REP
case "${REP:-O}" in [nN]*) die "Interrompu par l'opérateur." ;; esac

# ── 1. Paquets de base ────────────────────────────────────────────────
step "Installation de Docker"
if command -v docker >/dev/null 2>&1; then
    ok "Docker déjà présent ($(docker --version | cut -d, -f1))"
else
    apt-get update -qq || die "apt-get update a échoué — la Box est-elle sur internet ?"
    apt-get install -y -qq ca-certificates curl git || die "installation des prérequis"
    curl -fsSL https://get.docker.com | sh || die "installation de Docker"
    systemctl enable --now docker
    ok "Docker installé"
fi

# ── 2. ZeroTier — l'accès à distance d'abord ──────────────────────────
# Priorité absolue : tant que ZeroTier n'est pas debout, personne ne peut
# reprendre la main à distance et tout le reste devra se faire sur place.
step "Remise en route de l'accès distant (ZeroTier)"
if ! command -v zerotier-cli >/dev/null 2>&1; then
    curl -s https://install.zerotier.com | bash || die "installation de ZeroTier"
fi
systemctl stop zerotier-one 2>/dev/null

# La clé USB ne contient PAS la clé privée ZeroTier — c'est délibéré :
# elle permettrait à n'importe qui de se faire passer pour la Box sur le
# réseau. La Box repart donc avec une identité neuve, à autoriser une fois.
systemctl enable --now zerotier-one
sleep 5

NETID=""
[ -f "$LAST/zerotier/networks.txt" ] && NETID=$(head -1 "$LAST/zerotier/networks.txt")

if [ -n "$NETID" ]; then
    zerotier-cli join "$NETID" >/dev/null 2>&1 && ok "Réseau $NETID rejoint"
    # L'attribution de l'adresse prend quelques secondes
    for _ in $(seq 1 12); do
        ZTIP=$(zerotier-cli listnetworks 2>/dev/null | awk -v n="$NETID" '$3==n {print $NF}')
        [ -n "$ZTIP" ] && [ "$ZTIP" != "-" ] && break
        sleep 3
    done
    if [ -n "${ZTIP:-}" ] && [ "$ZTIP" != "-" ]; then
        ok "Accès distant opérationnel — adresse ZeroTier : $ZTIP"
    else
        echo
        echo "  ${BOLD}${YEL}ACTION REQUISE — à faire depuis n'importe quel navigateur${OFF}"
        echo "  Cette Box a une identité ZeroTier neuve, à autoriser une fois :"
        echo
        echo "     1. Ouvrir  https://my.zerotier.com/network/$NETID"
        echo "     2. Cocher 'Auth' en face du nœud  ${BOLD}$(zerotier-cli info 2>/dev/null | awk '{print $3}')${OFF}"
        echo
        echo "  L'accès distant sera actif dans les secondes qui suivent."
        echo "  Vérification sur place : sudo zerotier-cli listnetworks"
        echo
    fi
else
    warn "Aucun réseau ZeroTier dans la sauvegarde — accès distant non configuré."
fi

# ── 3. Code source ────────────────────────────────────────────────────
step "Récupération du code de la Box"
if [ -d "$EDUBOX_DIR/.git" ]; then
    ok "Dépôt déjà présent dans $EDUBOX_DIR"
else
    mkdir -p "$EDUBOX_DIR"
    git clone --depth 1 "$REPO" "$EDUBOX_DIR" 2>/dev/null \
        && ok "Code récupéré depuis GitHub" \
        || warn "Clone impossible — on repartira uniquement de la configuration sauvegardée"
fi

# ── 4. Configuration (.env, nginx, portail, certificats) ──────────────
step "Restauration de la configuration"
if [ -f "$LAST/config.tar.gz" ]; then
    tar -xzf "$LAST/config.tar.gz" -C "$EDUBOX_DIR" && ok "Configuration restaurée (dont .env et certificats)"
else
    die "config.tar.gz introuvable — impossible de reconstruire sans les mots de passe."
fi

# ── 4a. BUG-039 — rendre au dépôt ce qui lui appartient ───────────────
# config.tar.gz archive TOUT le répertoire, y compris des fichiers versionnés
# (docker-compose.yml, setup/app.py, les configs nginx…). Extraite après le
# clone, la sauvegarde réinstalle donc du code périmé par-dessus le code à
# jour — silencieusement : la Box repart, simplement des mois en arrière.
# Constaté le 2026-08-25 : dix fichiers écrasés, dont FEAT-033, 037, 038 et 039.
#
# `git checkout` ne touche QUE les fichiers suivis. Tout ce qui fait la valeur
# de la sauvegarde — .env, ssl/, portal/assets/, data/ — n'est pas versionné et
# reste donc intact.
if [ -d "$EDUBOX_DIR/.git" ]; then
    ECRASES=$(git -C "$EDUBOX_DIR" -c safe.directory="$EDUBOX_DIR" \
                  status --short --untracked-files=no 2>/dev/null | wc -l)
    if [ "$ECRASES" -gt 0 ]; then
        # On garde les versions de la sauvegarde : un écart de configuration
        # doit rester consultable plutôt que disparaître.
        GARDE="$EDUBOX_DIR/.restauration-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$GARDE"
        git -C "$EDUBOX_DIR" -c safe.directory="$EDUBOX_DIR" \
            status --short --untracked-files=no 2>/dev/null | awk '{print $2}' |
        while read -r f; do
            [ -f "$EDUBOX_DIR/$f" ] && (cd "$EDUBOX_DIR" && cp --parents "$f" "$GARDE/" 2>/dev/null)
        done
        git -C "$EDUBOX_DIR" -c safe.directory="$EDUBOX_DIR" checkout -- . 2>/dev/null
        ok "$ECRASES fichier(s) de code remis à jour depuis le dépôt"
        echo "    (versions de la sauvegarde conservées dans $(basename "$GARDE"))"
    else
        ok "Le code du dépôt et celui de la sauvegarde concordent"
    fi
else
    warn "Pas de dépôt git : la Box repart avec le code de la sauvegarde,"
    warn "qui peut avoir plusieurs mois de retard. À vérifier une fois en ligne."
fi

# ── 4b. Profils réseau (point d'accès Wi-Fi « Ofelia ») ───────────────
# Sans ça, la Box réinstallée n'émettrait plus aucun Wi-Fi : le point
# d'accès n'est recréé par aucun script, il vit dans NetworkManager.
step "Restauration du point d'accès Wi-Fi"
if [ -f "$LAST/network-profiles.tar.gz" ]; then
    tar -xzf "$LAST/network-profiles.tar.gz" -C /etc/NetworkManager/ 2>/dev/null
    chmod 600 /etc/NetworkManager/system-connections/* 2>/dev/null
    chown root:root /etc/NetworkManager/system-connections/* 2>/dev/null
    # BUG-039 : `systemctl reload` ne relit PAS les profils déposés après le
    # démarrage du service — les fichiers sont bien là, mais `nmcli connection
    # show` ne les voit pas, et le test ci-dessous conclut à tort qu'ils
    # manquent. `nmcli connection reload` les charge immédiatement.
    nmcli connection reload 2>/dev/null ||
        systemctl reload NetworkManager 2>/dev/null ||
        systemctl restart NetworkManager 2>/dev/null
    sleep 3
    if nmcli -t -f NAME connection show 2>/dev/null | grep -q "Ofelia-AP"; then
        nmcli connection up Ofelia-AP >/dev/null 2>&1 && ok "Point d'accès « Ofelia » réactivé"
    else
        warn "Profils restaurés mais Ofelia-AP introuvable — à vérifier"
    fi
else
    warn "Pas de profils réseau sauvegardés — le Wi-Fi devra être reconfiguré"
fi

# ── 5. Données BibliOfelia ────────────────────────────────────────────
step "Restauration des données BibliOfelia"
mkdir -p "$EDUBOX_DIR/data/bibliofelia/data"
if [ -f "$LAST/bibliofelia.sqlite3.gz" ]; then
    gunzip -c "$LAST/bibliofelia.sqlite3.gz" > "$EDUBOX_DIR/data/bibliofelia/data/bibliofelia.sqlite3" \
        && ok "Base BibliOfelia restaurée"
fi
if [ -f "$LAST/bibliofelia-media.tar.gz" ]; then
    tar -xzf "$LAST/bibliofelia-media.tar.gz" -C "$EDUBOX_DIR/data/bibliofelia/" \
        && ok "Médias restaurés (couvertures, fichiers téléversés)"
fi

# La sauvegarde MariaDB est restaurée plus tard, une fois MariaDB démarré
# depuis le portail d'admin : elle a besoin d'un serveur qui tourne.
[ -f "$LAST/mariadb-all.sql.gz" ] && \
    warn "MariaDB : à restaurer depuis le portail d'admin une fois la base démarrée"

# ── 5b. Unités systemd ────────────────────────────────────────────────
# Sans elles, la Box repartirait sans démarrage ordonné (les 14 conteneurs
# se lanceraient d'un coup, saturant la carte SD) et sans sauvegarde
# nocturne — deux absences qui ne se remarquent pas tout de suite.
step "Installation des services système"
if [ -d "$EDUBOX_DIR/systemd" ]; then
    install -m 644 "$EDUBOX_DIR"/systemd/*.service "$EDUBOX_DIR"/systemd/*.timer         /etc/systemd/system/ 2>/dev/null
    systemctl daemon-reload
    systemctl enable ofelia-boot.service >/dev/null 2>&1
    systemctl enable ofelia-backup.timer >/dev/null 2>&1
    # Installer une unité ne l'active pas : sans cette ligne, la surveillance
    # de la carte SD (FEAT-038) serait présente mais muette.
    systemctl enable ofelia-sd-health.timer >/dev/null 2>&1
    ok "Démarrage ordonné, sauvegarde nocturne et surveillance SD réinstallés"
else
    warn "Dossier systemd/ absent du dépôt — services à réinstaller à la main"
fi

# ── 5c. Durcissement du démarrage et des journaux ─────────────────────
# Trois réglages vivent dans /etc, donc hors du dépôt, et disparaîtraient
# sans cet appel : nofail sur /boot/firmware, journaux persistants, journaux
# Docker plafonnés. Ce sont exactement les garde-fous nés de BUG-038 — une
# Box reconstruite sans eux retomberait dans le même angle mort.
step "Durcissement du démarrage et des journaux"
if [ -x "$EDUBOX_DIR/scripts/durcir-boot.sh" ]; then
    "$EDUBOX_DIR/scripts/durcir-boot.sh" || warn "Durcissement incomplet — voir ci-dessus"
else
    warn "scripts/durcir-boot.sh absent — durcissement à faire à la main"
fi

# ── 6. Portail d'administration ───────────────────────────────────────
step "Démarrage du portail d'administration"
cd "$EDUBOX_DIR" || die "$EDUBOX_DIR inaccessible"
if docker compose build setup 2>&1 | tail -3 && docker compose up -d setup 2>&1 | tail -3; then
    ok "Portail d'administration démarré"
else
    die "Le portail n'a pas démarré. Diagnostic : docker compose logs setup"
fi

# ── 7. Récapitulatif ──────────────────────────────────────────────────
LANIP=$(hostname -I | awk '{print $1}')
ZTIP=$(zerotier-cli listnetworks 2>/dev/null | awk 'NR>1 {print $NF}' | head -1)
echo
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   REMISE EN ROUTE FAITE                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo
echo "  Portail d'administration :"
echo "     sur place      →  http://$LANIP:8080"
[ -n "${ZTIP:-}" ] && [ "$ZTIP" != "-" ] && \
echo "     à distance     →  http://${ZTIP%%/*}:8080"
echo
echo "  Mot de passe du portail : celui d'avant le sinistre"
echo "  (restauré avec la configuration)"
echo
echo "  Il reste à faire depuis le portail :"
echo "    • restaurer la base MariaDB (Moodle)"
echo "    • retélécharger les bibliothèques hors-ligne — liste dans :"
echo "      $LAST/MANIFEST.txt"
echo "    • démarrer les autres applications"
echo
