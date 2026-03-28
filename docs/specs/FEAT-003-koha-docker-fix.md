# FEAT-003 — Koha : conteneurisation Docker complète

**Statut** : DONE
**Date** : 2026-03-28

## Problèmes résolus

### mpm_itk vs mpm_prefork
- `koha-create` refuse de tourner sans `mpm_itk` (vérifie sa présence)
- `mpm_itk` en Docker : `initgroups()` échoue car les workers perdent CAP_SETGID après setuid → HTTP 500
- **Fix** : activer `mpm_itk` avant `koha-create`, puis basculer sur `mpm_prefork` après

### Socket Plack inaccessible (www-data)
- Starman (user `edubox-koha`) crée le socket avec umask 022 → mode 0755
- Apache (www-data) ne peut pas écrire sur le socket → `Permission denied`
- **Fix** : script `koha-plack-wrapper` qui exécute `umask 0` avant `koha-plack --start` → socket créé en 0777

### koha-create effets de bord dans Docker
- `koha-create` lance Apache/Zebra/Plack comme side effects → conflits avec supervisord
- **Fix** : stopper ces processus après `koha-create`, avant `exec supervisord`

### koha-conf.xml DOCTYPE
- `koha-create` génère un DOCTYPE pointant vers un DTD inaccessible en Docker → échec XML
- **Fix** : `sed -i '/<!DOCTYPE/d'` après `koha-create`

### DB koha inexistante (volume pré-existant)
- Les scripts init MariaDB ne tournent qu'au premier démarrage sur volume vide
- **Fix** : `entrypoint.sh` crée la DB/user koha via root si inaccessible (`KOHA_DB_ROOT_PASS`)

### Ports Apache
- `koha-create` redémarre Apache pendant l'init → Apache démarre sur port 80 si `ports.conf` pas mis à jour avant
- **Fix** : écrire `ports.conf` (Listen 8080/8081) AVANT d'appeler `koha-create`

### supervisord + daemon launchers
- `koha-zebra --start` et `koha-plack --start` sont des lanceurs one-shot (fork+exit 0)
- Avec `autorestart=true`, supervisord les relance en boucle infinie
- **Fix** : `autorestart=false`, `startsecs=0`, `exitcodes=0,1`

## Architecture résultante
```
supervisord
├── apache2 (mpm_prefork, foreground, autorestart=true)
├── zebra (koha-zebra --start, daemon wrapper, autorestart=false)
├── koha-plack (koha-plack-wrapper, umask 0, autorestart=false)
└── koha-sip (koha-sip --start, autorestart=false)
```
