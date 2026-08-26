#!/bin/bash
# Telechargement des contenus lourds — Kolibri (37 Go) et la bibliotheque
# Calibre (2835 livres depuis HuggingFace).
#
# ⚠️ A lancer DETACHE (systemd-run), jamais dans une session SSH : le
# 2026-08-26, deux telechargements lances directement en SSH sont morts avec la
# connexion quand le dongle Wi-Fi a decroche, apres 218 Mo et 117 Mo.
#
# Les deux commandes reprennent ou elles s etaient arretees : relancer ce
# script apres une coupure ne recommence pas de zero.
set -uo pipefail
KHAN_ES=c1f2b7e6ac9f56a2bb44fa7a48b66dce
J=/var/log/ofelia/contenus.log
dire() { echo "$(date "+%F %T")  $*" | tee -a "$J"; }

dire "=== Kolibri : metadonnees du canal Khan Academy (es) ==="
docker exec edubox-kolibri kolibri manage importchannel network "$KHAN_ES" >>"$J" 2>&1
dire "=== Kolibri : contenu (37 Go) ==="
docker exec edubox-kolibri kolibri manage importcontent network "$KHAN_ES" >>"$J" 2>&1
dire "Kolibri termine — $(du -sh /opt/edubox/data/kolibri | cut -f1)"

dire "=== Calibre : 2835 livres (3 shards) ==="
docker exec edubox-setup python3 /opt/edubox/setup/scripts/populate_books.py --shards 3 >>"$J" 2>&1
dire "Calibre termine — $(du -sh /opt/edubox/data/books | cut -f1)"
dire "=== TOUT EST TERMINE ==="
