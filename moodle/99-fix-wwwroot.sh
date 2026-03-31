#!/bin/sh
# Patch wwwroot to be dynamic: uses HTTP_HOST from nginx (works for any IP/hostname)
# Runs after 02-configure-moodle.sh which sets wwwroot=http://localhost/moodle
CONFIG=/var/www/html/config.php
chmod 644 "$CONFIG" 2>/dev/null || true

cat > /tmp/fix_wwwroot.php << 'PHPEOF'
<?php
$config = file_get_contents('/var/www/html/config.php');
$dynamic = '$CFG->wwwroot = \'http://\' . (PHP_SAPI === \'cli\' ? \'192.168.0.147\' : (isset($_SERVER[\'HTTP_HOST\']) ? $_SERVER[\'HTTP_HOST\'] : \'192.168.0.147\')) . \'/moodle\';';
$config = preg_replace('/\$CFG->wwwroot\s*=\s*[^;]+;/', $dynamic, $config);
file_put_contents('/var/www/html/config.php', $config);
echo "[fix-wwwroot] wwwroot patched to dynamic HTTP_HOST\n";
PHPEOF

php /tmp/fix_wwwroot.php
chmod 444 "$CONFIG" 2>/dev/null || true
