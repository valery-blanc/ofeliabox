# Shared portal locations — included in HTTP (port 80) and HTTPS (port 443) server blocks
# $back_btn est défini par un map dans edubox.conf (disponible dans tous les server blocks).
# `resolver 127.0.0.11` est déclaré une fois en contexte http dans edubox.conf.

# ── Identifiants : plus jamais en accès public ────────────────
# Ces deux fichiers exposaient les mots de passe de Moodle, Kolibri,
# MariaDB et Calibre à tout usager du réseau. Ils vivent désormais
# derrière le mot de passe du portail d'administration (port 8080).
# Les locations exactes priment sur les règles génériques plus bas,
# qui continuent de servir wizard-state.json au portail.
location = /credentials.html {
    return 302 http://$host:8080/credentials;
}
location = /credentials-data.json {
    return 404;
}

# ── Page d'attente au démarrage ───────────────────────────────
# Filet de sécurité : si une application ne répond pas alors que la séquence
# de démarrage est terminée, l'usager voit une page compréhensible et non un
# « 502 Bad Gateway ». Pendant le démarrage lui-même, c'est /boot-active.html
# qui est servi à la racine (voir plus bas).
error_page 502 503 504 @ofelia_starting;
location @ofelia_starting {
    root /var/www/edubox-portal;
    try_files /starting.html =503;
    add_header Retry-After 20 always;
    add_header Cache-Control "no-store" always;
}

# ── Page d'accueil / portail ──────────────────────────────────
# Pendant la séquence de démarrage, l'orchestrateur crée boot-active.html.
# `try_files` sert donc la page de progression tant qu'elle existe, puis le
# portail dès qu'elle est supprimée — sans rechargement de configuration.
location = / {
    root /var/www/edubox-portal;
    add_header Cache-Control "no-cache";
    # Indique a la page si elle est servie via un proxy amont (Traefik).
    sub_filter 'OFELIA_VIA_PROXY = false' 'OFELIA_VIA_PROXY = $via_upstream_proxy';
    sub_filter_once on;
    try_files /boot-active.html /index.html =404;
}
location = /assets/ofelia-ca.crt {
    alias /etc/nginx/ssl/ofelia-ca.crt;
    add_header Content-Type application/x-x509-ca-cert;
    add_header Content-Disposition 'attachment; filename="ofelia-ca.crt"';
}
location /assets/ {
    root /var/www/edubox-portal;
    expires 7d;
}
location ~ ^/[^/]+\.html$ {
    root /var/www/edubox-portal;
    add_header Cache-Control "no-cache";
    try_files $uri =404;
}

# Fichiers JSON du portail (wizard-state.json, boot-status.json)
# boot-status.json ne doit JAMAIS être mis en cache : c'est lui qui porte
# l'avancement du démarrage, relu toutes les 2 secondes par la page.
location ~ ^/[^/]+\.json$ {
    root /var/www/edubox-portal;
    add_header Cache-Control "no-store";
    try_files $uri =404;
}

# Status API (pour le portail)
# Statique : `proxy_pass http://healthcheck/api/status` — chemin identique,
# la forme à variable transmet l'URI d'origine, donc pas de rewrite.
location = /api/status {
    set $healthcheck http://edubox-healthcheck:8090;
    proxy_pass $healthcheck;
    proxy_read_timeout 5s;
}

# ── Moodle ───────────────────────────────────────────────────
# wwwroot Moodle = http://localhost/moodle — réécriture nginx obligatoire.
# $scheme permet au sub_filter de fonctionner en HTTP et HTTPS sans duplication.
# Statique : `proxy_pass http://moodle/` retirait le préfixe `/moodle/`.
# Le rewrite ci-dessous reproduit exactement ce comportement.
location /moodle/ {
    set $moodle http://edubox-moodle:8080;
    rewrite ^/moodle/(.*)$ /$1 break;
    proxy_pass $moodle;
    proxy_set_header Host $http_host;
    proxy_set_header Accept-Encoding "";
    proxy_read_timeout 300;
    client_max_body_size 200M;
    proxy_redirect http://localhost/moodle/ $scheme://$http_host/moodle/;
    proxy_redirect http://edubox-moodle:8080/ $scheme://$http_host/moodle/;
    sub_filter 'http://localhost/moodle' '$scheme://$http_host/moodle';
    sub_filter 'http:\/\/localhost\/moodle' '$scheme:\/\/$http_host\/moodle';
    sub_filter '</body>' $back_btn;
    sub_filter_once off;
}

# ── Kolibri ──────────────────────────────────────────────────
# Statique : `proxy_pass http://kolibri/kolibri/` — le préfixe était remplacé
# par lui-même, donc chemin inchangé : aucun rewrite nécessaire.
location /kolibri/ {
    set $kolibri http://edubox-kolibri:8080;
    proxy_pass $kolibri;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    proxy_buffering off;
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── Kiwix — Wikipedia, Wikisource et Gutenberg ───────────────
# Un seul conteneur sert les trois bibliothèques (trois fichiers ZIM).
# Statique : `proxy_pass http://kiwix/wiki/...` — chemin identique, pas de rewrite.
location = /wiki/viewer {
    set $kiwix http://edubox-kiwix:8080;
    proxy_pass $kiwix;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</head>' '<style>#content_iframe{height:calc(100dvh - 50px)!important;}</style></head>';
    # FEAT-041 : retour au portail. Kiwix a son propre bouton maison, mais il
    # ramene a /wiki/ — la liste des bibliotheques — et non au portail Ofelia.
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}
location /wiki/ {
    set $kiwix http://edubox-kiwix:8080;
    proxy_pass $kiwix;
    include /etc/nginx/proxy_params;
    # FEAT-041 : sans Accept-Encoding vide, la reponse arrive compressee et
    # sub_filter n'a rien a substituer — le bouton n'apparaitrait jamais.
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── BibliOfelia (gestion de bibliothèque hors-ligne) ────────
# FORCE_SCRIPT_NAME=/bibliofelia côté Django reconstruit toutes les URLs avec
# le préfixe — on retire donc le préfixe en proxifiant à la racine du container.
location /bibliofelia/static/ {
    alias /var/lib/bibliofelia-static/;
    expires 7d;
    access_log off;
}

location /bibliofelia/media/ {
    alias /var/lib/bibliofelia-media/;
    expires 1d;
    access_log off;
}

# Guide utilisateur (site statique MkDocs pré-buildé, Sprint 15).
# Servi en local par nginx, ne passe pas par Django. Doit être déclaré AVANT
# le `location /bibliofelia/` qui sinon attrape les requêtes.
location /bibliofelia/docs/ {
    alias /var/lib/bibliofelia-docs/;
    index index.html;
    try_files $uri $uri/ $uri/index.html =404;
    access_log off;

    # Pas de `expires` ici. Les pages du guide et surtout
    # `search/search_index.json` gardent un nom stable et changent de contenu à
    # chaque mise à jour : servis avec `expires 1d`, l'index de recherche d'un
    # utilisateur restait périmé pendant vingt-quatre heures et ne trouvait pas
    # les pages neuves. On révalide à chaque visite ; l'ETag rend un 304 sans
    # corps, ce qui ne coûte rien sur le réseau local.
    add_header Cache-Control "no-cache";
}

location /bibliofelia/ {
    set $bibliofelia http://edubox-bibliofelia:8001;
    rewrite ^/bibliofelia/(.*)$ /$1 break;
    proxy_pass $bibliofelia;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── Calibre-Web (bibliothèque numérique) ─────────────────────
# X-Script-Name informe Calibre-Web de son préfixe URL ; le rewrite
# supprime /calibre/ avant de transmettre la requête au container.
location /calibre/ {
    set $calibre http://edubox-calibre:8083;
    rewrite ^/calibre/(.*)$ /$1 break;
    proxy_pass $calibre;
    proxy_set_header X-Script-Name /calibre;
    proxy_set_header Host $http_host;
    proxy_redirect off;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── Dashboard healthcheck ─────────────────────────────────────
# Statique : `proxy_pass http://healthcheck/` retirait le préfixe `/status/`.
location /status/ {
    set $healthcheck_dash http://edubox-healthcheck:8090;
    rewrite ^/status/(.*)$ /$1 break;
    proxy_pass $healthcheck_dash;
    include /etc/nginx/proxy_params;
}

# ── Setup wizard API ──────────────────────────────────────────
# Sert la mise à jour des identifiants depuis /credentials.html, et le
# réglage de l'heure depuis la page de démarrage.
location /setup-api/ {
    set $setup http://edubox-setup:8080;
    rewrite ^/setup-api/(.*)$ /$1 break;
    proxy_pass $setup;
    include /etc/nginx/proxy_params;
}
