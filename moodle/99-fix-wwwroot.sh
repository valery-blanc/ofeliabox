#!/bin/sh
# Rend wwwroot dynamique : Moodle doit se voir à l'adresse par laquelle
# l'utilisateur l'atteint, quelle qu'elle soit (IP locale, ofelia.box,
# canaima.bibliofelia.org…).
#
# Le protocole doit l'être AUSSI. Traefik (sur Fez) termine le TLS et
# transmet en clair à la Box : Moodle ne voit que du HTTP. S'il fabrique
# des URL http:// dans une page servie en https, le navigateur les bloque
# comme contenu mixte — et Moodle perd ses feuilles de style. On lit donc
# X-Forwarded-Proto, transmis intact par nginx (voir conf.d/00-forwarded-proto.conf).
#
# Lancé après 02-configure-moodle.sh, qui met wwwroot=http://localhost/moodle.
CONFIG=/var/www/html/config.php
chmod 644 "$CONFIG" 2>/dev/null || true

cat > /tmp/fix_wwwroot.php << 'PHPEOF'
<?php
$config = file_get_contents('/var/www/html/config.php');

$dynamic = <<<'BLOC'
$_ofelia_proto = 'http';
if (PHP_SAPI !== 'cli') {
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        // L'en-tête peut contenir une liste ("https, http") : le premier fait foi.
        $_ofelia_proto = trim(strtok($_SERVER['HTTP_X_FORWARDED_PROTO'], ','));
    } else if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $_ofelia_proto = 'https';
    }
}
$_ofelia_proto = ($_ofelia_proto === 'https') ? 'https' : 'http';
$_ofelia_host = (PHP_SAPI === 'cli')
    ? '192.168.0.147'
    : (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '192.168.0.147');
$CFG->wwwroot = $_ofelia_proto . '://' . $_ofelia_host . '/moodle';
BLOC;

$config = preg_replace('/\$CFG->wwwroot\s*=\s*[^;]+;/', $dynamic, $config, 1);

// sslproxy doit suivre le protocole réel, sinon Moodle refuse la session
// ou reconstruit des URL http:// derrière le proxy TLS.
$config = preg_replace(
    '/\$CFG->sslproxy\s*=\s*[^;]+;/',
    '$CFG->sslproxy = ($_ofelia_proto === \'https\');',
    $config, 1
);

file_put_contents('/var/www/html/config.php', $config);
echo "[fix-wwwroot] wwwroot + sslproxy dynamiques (protocole via X-Forwarded-Proto)\n";
PHPEOF

php /tmp/fix_wwwroot.php
chmod 444 "$CONFIG" 2>/dev/null || true
