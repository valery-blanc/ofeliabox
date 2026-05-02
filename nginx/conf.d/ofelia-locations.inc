# Shared portal locations — included in HTTP (port 80) and HTTPS (port 443) server blocks
# $back_btn is defined via map in edubox.conf (available in all server contexts)

# ── Page d'accueil / portail ──────────────────────────────────
location = / {
    root /var/www/edubox-portal;
    index index.html;
    add_header Cache-Control "no-cache";
    try_files /index.html =404;
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

# ── Koha OPAC (public) ───────────────────────────────────────
location /biblio/ {
    proxy_pass http://koha_opac/;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── Koha Staff (admin, réseau local seulement) ───────────────
location /biblio-admin/ {
    proxy_pass http://koha_staff/;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
    allow 192.168.50.0/24;
    allow 192.168.0.0/24;
    allow 127.0.0.1;
    deny all;
}

# ── Koha OPAC CGI sans préfixe ───────────────────────────────
# proxy_redirect: opac-changelanguage.pl redirige vers / → corrigé vers /biblio/
location ~ ^/cgi-bin/koha/opac {
    proxy_pass http://koha_opac;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    proxy_redirect ~^/$ /biblio/;
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── Koha Staff CGI sans préfixe ──────────────────────────────
location /cgi-bin/koha/ {
    proxy_pass http://koha_staff/cgi-bin/koha/;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
    allow 192.168.50.0/24;
    allow 192.168.0.0/24;
    allow 127.0.0.1;
    deny all;
}

# ── Koha static assets (CSS/JS partagés OPAC+staff) ──────────
location /intranet-tmpl/ {
    proxy_pass http://koha_staff/intranet-tmpl/;
    include /etc/nginx/proxy_params;
    allow 192.168.50.0/24;
    allow 192.168.0.0/24;
    allow 127.0.0.1;
    deny all;
    expires 1h;
}

location /opac-tmpl/ {
    proxy_pass http://koha_opac/opac-tmpl/;
    include /etc/nginx/proxy_params;
    expires 1h;
}

# ── PMB (gestion bibliothèque) ───────────────────────────────
location /pmb/ {
    resolver 127.0.0.11 valid=10s;
    set $pmb http://edubox-pmb;
    proxy_pass $pmb;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</body>' $back_btn;
    sub_filter_once on;
}

# ── SLiMS (gestion bibliothèque) ─────────────────────────────
location /slims/ {
    resolver 127.0.0.11 valid=10s;
    set $slims http://edubox-slims;
    proxy_pass $slims;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
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

# ── Dashboard healthcheck ─────────────────────────────────────
location /status/ {
    proxy_pass http://healthcheck/;
    include /etc/nginx/proxy_params;
}
