#!/bin/bash
set -e

INSTANCE="${KOHA_INSTANCE:-edubox}"
DB_HOST="${KOHA_DB_HOST:-mariadb}"
DB_NAME="${KOHA_DB_NAME:-koha}"
DB_USER="${KOHA_DB_USER:-koha}"
DB_PASS="${KOHA_DB_PASS:-koha}"
MEMCACHED="${MEMCACHED_SERVER:-memcached:11211}"

echo "[EduBox Koha] Starting instance: $INSTANCE"

# Créer l'instance Koha si elle n'existe pas
if [ ! -d "/etc/koha/sites/$INSTANCE" ]; then
    echo "[EduBox Koha] Creating new instance: $INSTANCE"
    koha-create --create-db "$INSTANCE" \
        --dbhost "$DB_HOST" \
        --dbname "$DB_NAME" \
        --dbuser "$DB_USER" \
        --dbpass "$DB_PASS" || true

    # Configurer Memcached
    if [ -f "/etc/koha/sites/$INSTANCE/koha-conf.xml" ]; then
        sed -i "s|<memcached_servers>.*</memcached_servers>|<memcached_servers>$MEMCACHED</memcached_servers>|" \
            "/etc/koha/sites/$INSTANCE/koha-conf.xml"
    fi
fi

# Appliquer le mot de passe DB correct
if [ -f "/etc/koha/sites/$INSTANCE/koha-conf.xml" ]; then
    sed -i "s|<pass>.*</pass>|<pass>$DB_PASS</pass>|" \
        "/etc/koha/sites/$INSTANCE/koha-conf.xml"
fi

# Créer les répertoires de logs
mkdir -p "/var/log/koha/$INSTANCE"
chown -R "koha-$INSTANCE:koha-$INSTANCE" "/var/log/koha/$INSTANCE" 2>/dev/null || true

# Attendre que MariaDB soit prête
echo "[EduBox Koha] Waiting for MariaDB..."
for i in $(seq 1 30); do
    if mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SELECT 1" &>/dev/null; then
        echo "[EduBox Koha] MariaDB is ready"
        break
    fi
    echo "[EduBox Koha] Waiting for DB... ($i/30)"
    sleep 5
done

# Lancer le web installer si la DB est vide
TABLE_COUNT=$(mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME'" \
    --skip-column-names 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -lt "10" ]; then
    echo "[EduBox Koha] Running database installer..."
    koha-upgrade-to-refs "$INSTANCE" 2>/dev/null || true
fi

echo "[EduBox Koha] Starting services..."
exec "$@"
