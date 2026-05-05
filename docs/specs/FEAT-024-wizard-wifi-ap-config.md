# FEAT-024 — Wizard : configuration WiFi AP (SSID + mot de passe) inline

**Statut** : DONE 2026-05-05
**Composant** : `setup/templates/index.html`, `setup/app.py`

## Contexte

Le nom de la box (SSID de l'AP) était déjà configurable dans le wizard, mais le mot de passe WiFi de l'AP n'était ni visible ni modifiable. De plus, modifier le SSID ou le mot de passe nécessitait de relancer l'installation complète d'Ofelia.

## Comportement

### Section Configuration — ligne WiFi AP

Les champs "Nom WiFi (SSID)" et "Mot de passe WiFi" sont affichés **sur la même ligne** (`display: flex`, classe `.ap-row`), suivis d'un bouton **Modifier** aligné en bas.

- Le bouton Modifier applique le changement **immédiatement** (sans relancer l'installation) via `POST /api/ap/update`
- Validation côté client : SSID non vide, mot de passe ≥ 8 caractères si renseigné
- Feedback inline : `✓ WiFi mis à jour — réseau : "..."` ou message d'erreur
- Les deux valeurs sont pré-remplies depuis `/api/current-config` au chargement de la page (lecture nmcli si `.env` absent)

### Persistance

- `BOX_NAME` et `AP_PASS` sont écrits dans `/opt/edubox/.env` à chaque install et à chaque clic "Modifier"
- Au re-run du wizard, les valeurs sont restaurées depuis `.env` (préservées)

## Spec technique

### Route `POST /api/ap/update`

Corps JSON : `{ "ssid": "...", "pass": "..." }`

1. Valide SSID non vide, mot de passe ≥ 8 caractères
2. Appelle `nmcli con mod Ofelia-AP 802-11-wireless.ssid <ssid> [802-11-wireless-security.psk <pass>]`
3. `nmcli con down Ofelia-AP` puis `nmcli con up Ofelia-AP`
4. Met à jour `BOX_NAME` et `AP_PASS` dans `/opt/edubox/.env` par regex
5. Retourne `{"ok": true, "msg": "..."}` ou `{"ok": false, "error": "..."}`

### Route `GET /api/current-config`

Retourne maintenant `ap_pass` : lu depuis `.env` (clé `AP_PASS`) ou, si absent, depuis `nmcli -s con show Ofelia-AP` (lecture des secrets, possible car le wizard tourne en root).

### `.env`

Deux nouvelles clés persistées :
```
BOX_NAME=Ofelia
AP_PASS=OfeliaBox2024
```

### Constante

`AP_CON_NAME = "Ofelia-AP"` définie en tête de `setup/app.py` (nom de la connexion NetworkManager de l'AP).

## Fix Dockerfile connexe

Le `Dockerfile` du service `setup` ne copie plus les fichiers sources dans l'image (`COPY` supprimés). Il utilise `WORKDIR /opt/edubox/setup` (répertoire monté via le volume `/opt/edubox`). Cela permet de modifier `app.py` ou `templates/index.html` sur le Pi et de voir l'effet après un simple `docker compose restart setup`, sans rebuild d'image.
