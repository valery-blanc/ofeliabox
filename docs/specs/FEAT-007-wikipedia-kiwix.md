# FEAT-007 — Kiwix : Wikipedia ES + Wikisource ES hors-ligne

**Statut** : DONE
**Date** : 2026-03-28

## Contexte

Contenu encyclopédique et littéraire en espagnol hors-ligne pour les utilisateurs en Amérique du Sud. Kiwix sert des fichiers ZIM (snapshots compressés de sites web) sans connexion internet.

## Contenu déployé

| Fichier | Taille | Contenu |
|---|---|---|
| `wikipedia_es.zim` | 3.3 Go | Wikipedia ES mini 2026-02 — encyclopédie complète |
| `wikisource_es.zim` | 715 Mo | Wikisource ES nopic 2026-01 — œuvres libres (Cervantes, etc.) |

**Emplacement Pi** : `/opt/edubox/kiwix/data/`

## Configuration finale

### docker-compose.yml
```yaml
kiwix:
  image: ghcr.io/kiwix/kiwix-serve:latest
  container_name: edubox-kiwix
  restart: unless-stopped
  command: --urlRootLocation=/wiki wikipedia_es.zim wikisource_es.zim
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

**Notes importantes** :
- Kiwix écoute sur le port **8080** (pas 80 — l'image l'ajoute via ENTRYPOINT)
- `--urlRootLocation=/wiki` : Kiwix génère toutes ses URLs avec le préfixe `/wiki` nativement (évite d'avoir à réécrire via sub_filter)
- Ne pas redéclarer `--port=8080` dans `command` — l'image l'ajoute déjà, ça duplique le flag et kiwix-serve crashe

### nginx
```nginx
upstream kiwix { server edubox-kiwix:8080; }

# Fix mobile : injecter CSS pour que l'iframe occupe tout l'écran
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
```

### Portail (portal/index.html)
- Tuile Kiwix avec logo `wikipedia-es.png` (7.7 Ko, depuis `es.wikipedia.org/static/images/project-logos/eswiki.png`)
- i18n FR/EN/ES/PT/IT/DE
- `SERVICE_MAP` : `kiwix: 'wiki'`
- `checkStatus()` inclut `'wiki'`

### Healthcheck (healthcheck/app.py)
- Kiwix ajouté : `{"name": "kiwix", "container": "edubox-kiwix", "label": "Wikipedia (Kiwix)"}`

### Hostname additionnel
- `libofelia` ajouté dans `server_name` nginx — fonctionne automatiquement grâce au DNS captif (`address=/#/192.168.50.1`)

## Bugs découverts lors du déploiement

Voir fichiers dédiés :
- `BUG-001-koha-log-dir-missing.md` — Koha crash au redémarrage (log dir manquant)
- `BUG-002-kiwix-port-8080.md` — Kiwix port 8080 pas 80
- `BUG-003-kiwix-url-rewriting.md` — CSS/JS cassés avec sub_filter, fix via --urlRootLocation
- `BUG-004-kiwix-viewer-mobile.md` — Viewer Kiwix n'occupe que la moitié de l'écran mobile
