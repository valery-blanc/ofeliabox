# FEAT-007 — Wikipedia ES via Kiwix

**Statut** : DONE
**Date** : 2026-03-28

## Contexte

Wikipedia espagnole hors-ligne pour les utilisateurs en Amérique du Sud. Kiwix sert des fichiers ZIM (snapshots compressés de sites web) sans connexion internet.

## Solution

Conteneur Docker `kiwix-serve` avec le fichier ZIM `wikipedia_es_all_mini_2026-02.zim` (3.2 Go). Nginx proxifie `/wiki/` vers Kiwix avec sub_filter pour réécrire les URLs relatives.

## Fichier ZIM

- **Fichier** : `wikipedia_es_all_mini_2026-02.zim`
- **Taille** : ~3.2 Go
- **Emplacement Pi** : `/opt/edubox/kiwix/data/wikipedia_es.zim` (lien symbolique ou nom direct)
- **Commande kiwix-serve** : `wikipedia_es.zim`

## Configuration

### docker-compose.yml
```yaml
kiwix:
  image: ghcr.io/kiwix/kiwix-serve:latest
  container_name: edubox-kiwix
  restart: unless-stopped
  command: wikipedia_es.zim
  volumes:
    - ./kiwix/data:/data:ro
  networks:
    - edubox-net
  deploy:
    resources:
      limits:
        memory: 256M
  healthcheck:
    test: ["CMD", "curl", "-sf", "http://localhost:8080/"]
    interval: 60s
    timeout: 10s
    retries: 3
    start_period: 30s
```

**Note** : Kiwix écoute sur le port 8080 (pas 80).

### nginx — upstream et location
```nginx
upstream kiwix { server edubox-kiwix:8080; }

location /wiki/ {
    proxy_pass http://kiwix/;
    include /etc/nginx/proxy_params;
    sub_filter 'href="/' 'href="/wiki/';
    sub_filter 'src="/'  'src="/wiki/';
    sub_filter 'action="/' 'action="/wiki/';
    sub_filter_once off;
    sub_filter_types text/html;
}
```

### Portail (portal/index.html)
- Tuile Wikipedia avec logo `wikipedia-es.png` (7.7 Ko, téléchargé depuis `es.wikipedia.org/static/images/project-logos/eswiki.png`)
- i18n en FR/EN/ES/PT/IT/DE
- `SERVICE_MAP` : `kiwix: 'wiki'`
- `checkStatus()` inclut `'wiki'`

### Healthcheck (healthcheck/app.py)
- Kiwix ajouté à la liste `SERVICES` : `{"name": "kiwix", "container": "edubox-kiwix", "label": "Wikipedia (Kiwix)"}`

## Bugs découverts lors du déploiement

### Koha crash — log dir manquant
**Symptôme** : `koha-create` crée `/var/log/koha/edubox/` au premier démarrage, mais pas aux démarrages suivants (le bloc `if [ ! -f "koha-conf.xml" ]` est ignoré). Supervisord refuse de démarrer sans ce répertoire.
**Fix** : Ajout de `"/var/log/koha/$INSTANCE"` dans le `mkdir -p` de l'entrypoint, AVANT le bloc conditionnel `koha-create`.
**Fichier modifié** : `koha/entrypoint.sh`

### Kiwix port 8080 (pas 80)
**Symptôme** : `ghcr.io/kiwix/kiwix-serve` écoute sur le port 8080, pas 80. Nginx et healthcheck pointaient sur le port 80 → 502 Bad Gateway.
**Fix** : Upstream nginx et healthcheck mis à jour vers le port 8080.
