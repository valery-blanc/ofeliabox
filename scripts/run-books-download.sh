#!/bin/bash
# Lance populate_books.py shard par shard — un process Python frais à chaque fois.
# Séquentiel : books d'abord, Kolibri import ensuite.
#
# Un process neuf par shard : le script accumule de la mémoire et finissait par
# se faire tuer sur les 4 Go du Pi. La reprise se lit dans le journal, ce qui
# rend l'opération interruptible — elle dure des heures.
#
# ⚠️ Versionné le 2026-09-11 : il vivait sur la Box sans jamais avoir été
# committé. Il pointait alors vers `/opt/edubox/scripts/populate_books.py`, une
# copie de **271 lignes** restée sur la Box, alors que la version maintenue —
# `setup/scripts/populate_books.py`, seule suivie par git — en fait **425** et
# ajoute `process_local_shard` et `_to_iso_date`. Le chemin a donc été corrigé
# ici : sur une installation neuve, l'ancien chemin n'existe même pas.
# La copie périmée reste sur la Box, non suivie ; à supprimer après vérification.

LOG=/opt/edubox/books-download.log
SCRIPT=/opt/edubox/setup/scripts/populate_books.py
TOTAL=129

# Retrouve le dernier shard complété (ligne "✓ X livres ajoutés" précédée d'un "Shard N/")
last_done=0
current_shard=0
while IFS= read -r line; do
    if [[ "$line" =~ ^Shard\ ([0-9]+)/[0-9]+ ]]; then
        current_shard=${BASH_REMATCH[1]}
    elif [[ "$line" =~ "✓" ]] && [[ $current_shard -gt 0 ]]; then
        last_done=$current_shard
    fi
done < "$LOG"
start=$(( last_done + 1 ))

echo "=== Reprise books depuis shard $start/$TOTAL — $(date) ===" >> "$LOG"

for i in $(seq $start $TOTAL); do
    echo ">>> Shard $i/$TOTAL — $(date '+%H:%M:%S')" >> "$LOG"
    python3 "$SCRIPT" --shards 1 --start-shard "$i" >> "$LOG" 2>&1
    rc=$?
    if [ $rc -ne 0 ]; then
        echo "!!! Shard $i ÉCHOUÉ (exit $rc) — $(date '+%H:%M:%S')" >> "$LOG"
    fi
    sleep 5
done

echo "=== Books terminés — $(date) ===" >> "$LOG"

# Lancer Kolibri import
echo "=== Démarrage Kolibri import — $(date) ===" >> /opt/edubox/kolibri-import.log
bash /opt/edubox/scripts/edubox-kolibri-import.sh >> /opt/edubox/kolibri-import.log 2>&1
echo "=== Kolibri import terminé — $(date) ===" >> /opt/edubox/kolibri-import.log
