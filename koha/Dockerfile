FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV KOHA_INSTANCE=edubox
ENV KOHA_CONF=/etc/koha/sites/edubox/koha-conf.xml

# Ajouter le dépôt Koha officiel
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        wget gnupg2 ca-certificates apt-transport-https && \
    echo "deb http://debian.koha-community.org/koha stable main" \
        > /etc/apt/sources.list.d/koha.list && \
    wget -qO- https://debian.koha-community.org/koha/gpg.asc | \
        gpg --dearmor > /etc/apt/trusted.gpg.d/koha.gpg && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        koha-common \
        memcached \
        supervisor \
        curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copier les fichiers de configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY SIPconfig.xml /etc/koha/SIPconfig.xml
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Wrapper script for koha-plack: sets umask 0 so plack.sock is created as 0777
# (needed because Apache www-data must write to the socket for proxy mode)
RUN printf '#!/bin/bash\numask 0\nexec koha-plack --start "$@"\n' \
    > /usr/local/sbin/koha-plack-wrapper && \
    chmod +x /usr/local/sbin/koha-plack-wrapper

# Écrire koha-sites.conf directement (évite les problèmes CRLF et cache Docker)
RUN printf 'OPACPORT="8080"\nINTRAPORT="8081"\nOPACPREFIX=""\nOPACSUFFIX=""\nINTRAPREFIX=""\nINTRASUFFIX=""\nDEFAULTSITES="/etc/koha/sites"\nUSE_MEMCACHED="yes"\n' \
    > /etc/koha/koha-sites.conf

# Ports : 8080 (OPAC), 8081 (staff), 6001 (SIP2)
EXPOSE 8080 8081 6001

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
