#!/usr/bin/env bash
# make-box.sh — Provisionne une box Ofelia selon un profil
# Usage : sudo bash make-box.sh --profile <nom> [--dry-run] [--dest /opt/edubox]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
PROFILE=""
DRY_RUN=0
DEST="/opt/edubox"

usage() {
  echo "Usage: sudo bash make-box.sh --profile <nom> [--dry-run] [--dest /chemin]"
  echo ""
  echo "Profils disponibles :"
  for d in "$REPO_DIR/profiles"/*/; do
    [[ -f "$d/profile.env" ]] && echo "  $(basename "$d")"
  done
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --profile) PROFILE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --dest)    DEST="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Option inconnue : $1"; usage ;;
  esac
done

[[ -z "$PROFILE" ]] && { echo "Erreur : --profile requis"; usage; }

PROFILE_FILE="$REPO_DIR/profiles/$PROFILE/profile.env"
[[ ! -f "$PROFILE_FILE" ]] && { echo "Profil introuvable : $PROFILE_FILE"; exit 1; }

# shellcheck source=/dev/null
source "$PROFILE_FILE"

echo "╔═══════════════════════════════════════════════╗"
printf  "║  Ofelia — Box : %-30s║\n" "$BOX_NAME"
echo "╚═══════════════════════════════════════════════╝"
echo "  Profil        : $PROFILE"
echo "  Langue défaut  : $DEFAULT_LANG"
echo "  Destination    : $DEST"
[[ $DRY_RUN -eq 1 ]] && echo "  Mode           : DRY RUN (aucun fichier modifié)"
echo ""

KIWIX_DATA="$DEST/kiwix/data"
ZIMS_LIST=""

download_zim() {
  local short_name="$1"
  local url="$2"
  local dest_file="$KIWIX_DATA/$short_name"

  if [[ -f "$dest_file" ]]; then
    local size
    size=$(du -sh "$dest_file" 2>/dev/null | cut -f1)
    echo "  [EXISTE]      $short_name ($size)"
  else
    echo "  [TÉLÉCHARGER] $short_name"
    echo "                depuis : $url"
    if [[ $DRY_RUN -eq 0 ]]; then
      mkdir -p "$KIWIX_DATA"
      wget --progress=dot:giga -O "${dest_file}.tmp" "$url"
      mv "${dest_file}.tmp" "$dest_file"
      echo "  [OK]          $short_name téléchargé"
    fi
  fi
  ZIMS_LIST="$ZIMS_LIST $short_name"
}

echo "── ZIM files ───────────────────────────────────"
[[ -n "${ZIM_WIKIPEDIA:-}" && -n "${ZIM_WIKIPEDIA_URL:-}" ]] && \
  download_zim "$ZIM_WIKIPEDIA" "$ZIM_WIKIPEDIA_URL"
[[ -n "${ZIM_WIKISOURCE:-}" && -n "${ZIM_WIKISOURCE_URL:-}" ]] && \
  download_zim "$ZIM_WIKISOURCE" "$ZIM_WIKISOURCE_URL"
[[ -n "${ZIM_GUTENBERG:-}" && -n "${ZIM_GUTENBERG_URL:-}" ]] && \
  download_zim "$ZIM_GUTENBERG" "$ZIM_GUTENBERG_URL"

NEW_CMD="--urlRootLocation=/wiki$ZIMS_LIST"
echo ""
echo "── Commande Kiwix ──────────────────────────────"
echo "  command: $NEW_CMD"

DC_FILE="$DEST/docker-compose.yml"
echo ""
echo "── docker-compose.yml ──────────────────────────"
if [[ ! -f "$DC_FILE" ]]; then
  echo "  [WARN] $DC_FILE introuvable — mise à jour manuelle requise"
elif [[ $DRY_RUN -eq 0 ]]; then
  cp "$DC_FILE" "${DC_FILE}.bak"
  sed -i "s|command: --urlRootLocation=/wiki.*|command: $NEW_CMD|" "$DC_FILE"
  echo "  [OK] Mis à jour (sauvegarde : docker-compose.yml.bak)"
else
  echo "  [DRY RUN] Remplacerait la ligne command: kiwix par :"
  echo "    command: $NEW_CMD"
fi

echo ""
echo "── Prochaines étapes ───────────────────────────"
if [[ $DRY_RUN -eq 1 ]]; then
  echo "  Relancer sans --dry-run pour appliquer les changements."
else
  echo "  1. cd $DEST && docker compose restart kiwix"
  echo "  2. Vérifier : http://192.168.50.1/wiki/"
  if [[ "$PROFILE" != "ofelia-es" ]]; then
    echo ""
    echo "  IMPORTANT : mettre à jour portal/index.html pour les liens kiwix :"
    echo "  Voir profiles/$PROFILE/profile.env pour les instructions sed."
  fi
fi
echo ""
