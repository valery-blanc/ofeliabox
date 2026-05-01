# FEAT-013 — Setup Wizard Web UI

**Statut** : IN PROGRESS  
**Date** : 2026-05-01

---

## Contexte

Pour créer une nouvelle box Ofelia depuis un Raspberry Pi vierge (nouvelle SD 512 GB),
l'utilisateur doit pouvoir choisir ce qu'il veut installer via une interface web, puis
lancer l'installation automatiquement — sans toucher à la ligne de commande.

---

## Fonctionnement

### Bootstrap (une seule commande)

Sur un Pi vierge avec Raspberry Pi OS Lite :

```bash
curl -sSL https://raw.githubusercontent.com/valery-blanc/ofeliabox/main/bootstrap.sh | sudo bash
```

Cela :
1. Installe Docker + git + python3-pip
2. Clone le repo dans `/opt/edubox/`
3. Installe Flask (`pip3 install flask`)
4. Lance le wizard sur le port 8080

### Interface web

Accessible à `http://<IP-du-Pi>:8080/` depuis n'importe quel appareil sur le même réseau.

**Section 1 — Applications** (cases à cocher, avec badge "Recommandé" / "Optionnel") :
- Moodle ✓ · Kolibri ✓ · Koha ✓ · PMB · SLiMS · Digistorm

**Section 2 — Bibliothèques hors-ligne** (groupées par langue, taille affichée) :
- 🇪🇸 Wikipedia ES (3.4 Go) ✓ · Wikisource ES (728 Mo) · Gutenberg ES (1.7 Go)
- 🇫🇷 Wikipedia FR (1.1 Go) · Wikisource FR (11 Go ⚠️) · Gutenberg FR (9.8 Go ⚠️)

**Section 3 — Configuration** :
- Nom de la box
- Mot de passe admin Moodle (affiché dans `/credentials.html` après install)
- Mot de passe root MariaDB (interne, auto-généré si vide)

**Barre fixe en bas** : résumé (nb apps · taille totale) + bouton "Installer"

**Console d'installation** (apparaît au clic) :
- Barres de progression pour chaque ZIM téléchargé
- Logs en temps réel via SSE (Server-Sent Events)
- Message "✅ Installation terminée" avec lien vers le portail

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `bootstrap.sh` | Bootstrap Pi vierge (Docker + clone + démarrage wizard) |
| `setup/app.py` | Backend Flask : génère .env, télécharge ZIMs, lance docker compose |
| `setup/requirements.txt` | `flask` |
| `setup/templates/index.html` | UI complète (dark theme Ofelia, SSE streaming) |
| `portal/credentials.html` | Charge `credentials-data.json` généré par le wizard |

---

## Flux d'installation (backend)

1. Écriture `.env` avec mots de passe (saisis ou auto-générés)
2. Écriture `portal/credentials-data.json` (pour la page identifiants)
3. Création des répertoires `/opt/edubox/data/...` avec bons UIDs
4. Téléchargement des ZIMs sélectionnés (avec barre de progression SSE)
5. Patch `docker-compose.yml` — commande kiwix selon ZIMs sélectionnés
6. `docker compose pull` + `docker compose up -d` sur les services sélectionnés
7. Affichage du lien vers le portail

---

## Déploiement sur un Pi existant (Ofelia)

Le wizard peut aussi être utilisé sur la box actuelle pour changer la configuration :

```bash
python3 /opt/edubox/setup/app.py
# Ouvrir http://192.168.0.147:8080/
```
