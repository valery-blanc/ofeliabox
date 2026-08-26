# BUG-039 — La restauration réinstalle du code périmé par-dessus le code à jour

**Statut :** CORRIGÉ — en attente du test de Val
**Constaté :** 2026-08-25, au premier passage réel de `RESTAURER-OFELIA.sh` sur
une machine vierge (case non cochée de `TASKS.md` depuis sa création).

---

## Le symptôme

Après une restauration réussie — le script se termine sans erreur et annonce
« REMISE EN ROUTE FAITE » — la Box tourne avec **le code du 21 août**, pas le
code courant. `git status` dans `/opt/edubox` :

```
 M docker-compose.yml
 M docs/tasks/TASKS.md
 M nginx/conf.d/edubox.conf
 M nginx/conf.d/ofelia-locations.inc
 M nginx/proxy_params
 M portal/credentials.html
 M portal/index.html
 M scripts/RESTAURER-OFELIA.sh
 M setup/app.py
 M setup/templates/index.html
```

**Dix fichiers**, et les régressions sont sérieuses :

| Perdu | Conséquence |
|---|---|
| `docker-compose.yml` | FEAT-039 annulé : Docker restaure de nouveau les 14 conteneurs, +4 min 34 au démarrage |
| `setup/app.py` | routes `/boot` (FEAT-037) et `/api/sd-health` (FEAT-038) disparues |
| `setup/templates/index.html` | panneau de surveillance de la carte SD disparu |
| `nginx/conf.d/*` | résolution dynamique de FEAT-033 : nginx ne démarre plus seul |
| `scripts/RESTAURER-OFELIA.sh` | le script se remplace lui-même par sa version d'août |

## La cause

L'ordre des étapes. Le script récupère le code, **puis** déverse la sauvegarde
par-dessus :

```bash
# ── 3. Code source ──
git clone --depth 1 "$REPO" "$EDUBOX_DIR"

# ── 4. Configuration ──
tar -xzf "$LAST/config.tar.gz" -C "$EDUBOX_DIR"   # ← écrase le code
```

`config.tar.gz` est produit par `backup-usb.sh`, qui archive tout le répertoire
de configuration — y compris des fichiers **versionnés** (`docker-compose.yml`,
`setup/app.py`, `portal/index.html`, les configs nginx). La sauvegarde ne
distingue pas ce qui appartient au dépôt de ce qui n'y est pas.

Le défaut est silencieux : le script ne peut pas se plaindre, il fait
exactement ce qu'on lui a demandé. Sans dépôt git pour comparer, personne ne
verrait la différence — la Box marcherait, simplement quatre mois en arrière.

## Le correctif

Après extraction, rendre au dépôt ce qui lui appartient :

```bash
git checkout -- .
```

Une ligne, placée juste après le `tar`. Elle ne touche **que** les fichiers
suivis par git : `.env`, `ssl/`, `portal/assets/`, `data/` — tout ce qui n'est
pas versionné et fait la valeur de la sauvegarde — reste intact.

Les versions issues de la sauvegarde sont d'abord copiées dans
`.restauration-<date>/`, pour qu'un écart de configuration reste consultable
plutôt que perdu.

⚠️ **Ce correctif suppose que le dépôt est à jour.** Si le clone échoue (pas
d'internet, dépôt privé sans identifiants), `git checkout` n'a rien à
restaurer, et la sauvegarde reste le seul recours — c'est le comportement
voulu, mais le script le dit maintenant explicitement au lieu de le laisser
deviner.

## Deuxième défaut, trouvé au même passage

**Les profils Wi-Fi restaurés ne sont pas pris en compte.** Le script fait :

```bash
tar -xzf network-profiles.tar.gz -C /etc/NetworkManager/
systemctl reload NetworkManager
```

Les fichiers arrivent bien dans `/etc/NetworkManager/system-connections/`, mais
`nmcli connection show` ne les voit pas : `systemctl reload` ne relit pas les
profils déposés après le démarrage du service. D'où l'avertissement
« Profils restaurés mais Ofelia-AP introuvable » — alors que le fichier est là.

`nmcli connection reload` les charge immédiatement. Vérifié sur la Box : les
trois profils (`Ofelia-AP`, `Lirac_5G`, `chateauneuf`) apparaissent aussitôt.

## Fichiers

| Fichier | Nature |
|---|---|
| `scripts/RESTAURER-OFELIA.sh` | `git checkout` après extraction, `nmcli connection reload`, sauvegarde des versions écrasées |

## Vérifications effectuées

Sur la Box remontée depuis une carte vierge, après correctif :

| Contrôle | Résultat |
|---|---|
| `git status --untracked-files=no` | **0 fichier modifié** |
| `restart: "no"` dans le compose | **9 services** (FEAT-039 présent) |
| Route `/boot` dans `setup/app.py` | présente |
| `api_sd_health` dans `setup/app.py` | présente |
| Panneau `sd-panel` dans le gabarit | présent |
| `resolver` dans la config nginx | présent |
| `.env`, certificats, images du portail | **intacts** (12 images) |
| Profils Wi-Fi après `nmcli connection reload` | les 3 visibles |

⚠️ **Non vérifié : un cycle complet de restauration après correctif.** Le
correctif a été appliqué à une Box déjà restaurée, pas rejoué depuis zéro. Le
prochain sinistre sera son vrai test.
