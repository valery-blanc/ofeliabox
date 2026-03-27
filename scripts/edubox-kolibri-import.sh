#!/bin/bash
# EduBox — Import des channels Kolibri
# À exécuter une fois avec internet disponible

set -euo pipefail

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Channels à importer (décommenter selon besoin et espace disque)
CHANNELS=(
    "1ceff53605e55bef987d88e0908658c5"  # Khan Academy (sélection FR/EN/ES) ~15 Go
    "2e969a23e8af58d196662a24f5fe1b0c"  # Wikipedia (sélection) ~5 Go
    "f9d3e0e46ea25789bbed672ff6a399ed"  # African Storybook ~500 Mo
    # "63f7e82e20fa5b74a462901be4d4e2f0"  # CK-12 Foundation ~2 Go
    # "d15e83ba24b85b05a9a5a8e3e53f12f2"  # Pratham Books ~1 Go
    # "e625c30276c05be1bf70736e2c85d27f"  # Blockly Games ~50 Mo
)

if ! docker ps --format '{{.Names}}' | grep -q "edubox-kolibri"; then
    echo "ERROR: edubox-kolibri container is not running"
    exit 1
fi

for channel_id in "${CHANNELS[@]}"; do
    log "Importing channel: $channel_id"
    docker exec edubox-kolibri kolibri manage importchannel network "$channel_id" || {
        log "WARNING: Failed to import channel $channel_id — skipping"
        continue
    }
    docker exec edubox-kolibri kolibri manage importcontent network "$channel_id" || {
        log "WARNING: Failed to import content for $channel_id — skipping"
    }
    log "Done: $channel_id"
done

log "All channels imported."
