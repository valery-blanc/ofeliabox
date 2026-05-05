# FEAT-026 — Mot de passe Calibre-Web dans le wizard

**Statut** : DONE 2026-05-05
**Composant** : `setup/templates/index.html`, `setup/app.py`

## Contexte

Le mot de passe administrateur Calibre-Web (`admin`) était figé à `Admin2026!` dans `credentials-data.json` mais n'était jamais appliqué réellement — Calibre-Web conservait son mot de passe par défaut ou celui défini manuellement. Il n'existait aucun moyen de le définir depuis le wizard.

## Comportement

Champ **"Mot de passe administrateur Calibre-Web"** ajouté dans la section Configuration du wizard, après MariaDB.

- Placeholder : "Laisse vide pour auto-générer"
- Hint : "Utilisateur : admin — appliqué uniquement si la tuile Calibre-Web est sélectionnée"
- Pré-rempli au chargement depuis `/api/current-config` (clé `calibre_admin`, lue depuis `.env`)

## Spec technique

### `.env`

Nouvelle clé persistée :
```
CALIBRE_ADMIN_PASS=<valeur>
```
Préservée au re-run du wizard (logique `_get()` existante).

### Payload d'installation

`passwords.calibre_admin` inclus dans le JSON envoyé à `POST /api/install`.

### Application du mot de passe — `_set_calibre_password(password)`

Calibre-Web stocke les mots de passe en hash **scrypt** (Werkzeug) dans `/config/app.db` (SQLite, table `user`). Le login web nécessite un token CSRF, ce qui rend l'approche HTTP fragile. La méthode retenue est plus directe :

```python
docker exec edubox-calibre python3 -c "
from werkzeug.security import generate_password_hash
import sqlite3
h = generate_password_hash('<password>')
conn = sqlite3.connect('/config/app.db')
conn.execute('UPDATE user SET password=? WHERE name=?', (h, 'admin'))
conn.commit(); conn.close()
print('ok')
"
```

Avantages : pas de CSRF, pas de session, fonctionne même si le mot de passe courant est inconnu.

Cette fonction est appelée dans `_install_stream` immédiatement après `_configure_calibre_web()`, uniquement si `"calibre" in services`.

### `/api/current-config`

Retourne `calibre_admin` depuis `env.get("CALIBRE_ADMIN_PASS", "")`.

## Pourquoi pas via l'API web Calibre-Web

Le login web de Calibre-Web requiert un token CSRF extrait de la page GET `/login`, puis une session cookie valide. Cette approche est fragile (CSRF change à chaque session, mot de passe courant inconnu). La mise à jour directe de `app.db` via Werkzeug dans le container est plus robuste et ne dépend pas de l'état HTTP de l'application.
