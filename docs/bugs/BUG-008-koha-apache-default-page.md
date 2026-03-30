---
id: BUG-008
title: Koha OPAC — page Apache par défaut sur /biblio/
status: FIXED
date: 2026-03-30
---

## Symptôme

`http://192.168.0.147/biblio/` affiche la page "Apache2 Debian Default Page: It works"
au lieu de l'OPAC Koha.

## Cause racine (3 bugs cumulés)

### 1. Site Apache `edubox.conf` non activé (`sites-enabled`)

`koha-create` génère `/etc/apache2/sites-available/edubox.conf` et fait `a2ensite edubox`,
mais cette symlink n'est PAS persistée (pas de volume `/etc/apache2/`). À chaque recréation
du container, seul `000-default.conf` est activé (port 80), alors que les vhosts Koha
écoutent sur 8080/8081.

### 2. Host header mismatch (ServerName / ServerAlias)

Nginx transmet `Host: 192.168.0.147` (via `proxy_params`). Le vhost Koha a
`ServerName edubox` sans `ServerAlias`. Apache ne matche aucun vhost → sert la page
par défaut.

### 3. Fichiers de log créés en root, Plack ne peut pas écrire

`opac-error.log` et `intranet-error.log` n'existent pas avant le démarrage de supervisord.
C'est supervisord/Apache (root) qui les crée en premier. Plack (`edubox-koha`) hérite
ensuite une erreur "Permission denied" et crashe en boucle → 502.

## Diagnostic

```bash
# sites-enabled ne contient que 000-default
docker exec edubox-koha ls /etc/apache2/sites-enabled/
# → 000-default.conf  (edubox.conf absent)

# Curl direct → page Apache par défaut
docker exec edubox-koha curl -si http://localhost:8080/ | head -5
# → Apache2 Debian Default Page

# Plack crash loop
docker exec edubox-koha cat /var/log/koha/edubox/plack-error.log | tail -5
# → Can't open /var/log/koha/edubox/opac-error.log (Permission denied)
```

## Fix appliqué — `koha/entrypoint.sh`

### Fix 1 : forcer a2ensite + a2dissite
```bash
a2ensite "$INSTANCE"
a2dissite 000-default
```
Exécuté à chaque démarrage du container (après koha-create ou non).

### Fix 2 : ServerAlias *
```bash
sed -i '/ServerName/a\    ServerAlias *' "$APACHE_CONF"
```
Apache accepte désormais n'importe quel Host header.

### Fix 3 : pré-créer les fichiers de log avant supervisord
```bash
for logfile in opac-error.log intranet-error.log zebra.log sip.log; do
    touch "/var/log/koha/$INSTANCE/$logfile"
done
chown -R "$KOHA_USER:" "/var/log/koha/$INSTANCE/"
chmod 664 /var/log/koha/"$INSTANCE"/*.log
chmod 775 "/var/log/koha/$INSTANCE/"
```
Les fichiers existent déjà avec le bon ownership quand Apache (root) les ouvre
→ Apache les ouvre sans les recréer → Plack peut écrire dedans.

## Résultat

`http://192.168.0.147/biblio/` → 200 OK, OPAC Koha fonctionnel.
