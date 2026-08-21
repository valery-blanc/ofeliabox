# Shared portal locations — included in HTTP (port 80) and HTTPS (port 443) server blocks
# $back_btn is defined via map in edubox.conf (available in all server contexts)

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
# Au boot, les applications mettent du temps à répondre pendant que la
# carte SD est saturée. Sans ça, l'usager reçoit un « 502 Bad Gateway »
# incompréhensible et croit la Box en panne. S'applique à toutes les
# locations de ce fichier qui ne la redéfinissent pas.
error_page 502 503 504 @ofelia_starting;
location @ofelia_starting {
    root /var/www/edubox-portal;
    try_files /starting.html =503;
    add_header Retry-After 20 always;
    add_header Cache-Control "no-store" always;
}

# ── Page d'accueil / portail ──────────────────────────────────
location = / {
    root /var/www/edubox-portal;
    index index.html;
    add_header Cache-Control "no-cache";
    try_files /index.html =404;
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

# Fichiers JSON du portail (credentials-data.json, wizard-state.json)
location ~ ^/[^/]+\.json$ {
    root /var/www/edubox-portal;
    add_header Cache-Control "no-cache";
    try_files $uri =404;
}

# Status API (pour le portail)
location = /api/status {
    proxy_pass http://healthcheck/api/status;
    proxy_read_timeout 5s;
}

# ── Moodle ───────────────────────────────────────────────────
# wwwroot Moodle = http://localhost/moodle — réécriture nginx obligatoire.
# $scheme permet au sub_filter de fonctionner en HTTP et HTTPS sans duplication.
location /moodle/ {
    proxy_pass http://moodle/;
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
location /kolibri/ {
    proxy_pass http://kolibri/kolibri/;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    proxy_buffering off;
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── Kiwix / Wikipedia ────────────────────────────────────────
location = /wiki/viewer {
    proxy_pass http://kiwix/wiki/viewer;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</head>' '<style>#content_iframe{height:calc(100dvh - 50px)!important;}</style></head>';
    sub_filter_once on;
}
location /wiki/ {
    proxy_pass http://kiwix/wiki/;
    include /etc/nginx/proxy_params;
}

# ── BibliOfelia (gestion de bibliothèque hors-ligne) ────────
# Cohabite avec Koha (qui reste sur /biblio/). FORCE_SCRIPT_NAME=/bibliofelia
# côté Django reconstruit toutes les URLs avec le préfixe — on retire donc
# le préfixe en proxifiant à la racine du container.
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
    expires 1d;
    access_log off;
}

location /bibliofelia/ {
    resolver 127.0.0.11 valid=10s;
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
    proxy_pass http://edubox-calibre:8083/;
    proxy_set_header X-Script-Name /calibre;
    proxy_set_header Host $http_host;
    proxy_redirect off;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── Dashboard healthcheck ─────────────────────────────────────
location /status/ {
    proxy_pass http://healthcheck/;
    include /etc/nginx/proxy_params;
}

# ── Setup wizard API (pour mise à jour credentials depuis /credentials.html) ──
location /setup-api/ {
    resolver 127.0.0.11 valid=10s;
    set $setup http://edubox-setup:8080;
    rewrite ^/setup-api/(.*)$ /$1 break;
    proxy_pass $setup;
    include /etc/nginx/proxy_params;
}
