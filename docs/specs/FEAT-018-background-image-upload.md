# FEAT-018 — Upload image de fond dans le wizard

**Status:** DONE
**Date:** 2026-05-02

## Context

Le portail principal affiche une image de fond (`portal/assets/background.png`).
L'utilisateur souhaite pouvoir la remplacer depuis l'assistant d'installation
sans accès SSH.

## Behavior

Dans la section "Configuration" du wizard :
- Champ `<input type="file" accept="image/*">` labellé "Image de fond du portail"
- Preview de l'image sélectionnée
- Au clic sur "Installer", si une image est sélectionnée, elle est uploadée
  via POST `/api/upload-background` avant le démarrage de l'installation
- L'image est sauvegardée comme `/opt/edubox/portal/assets/background.png`
- Formats supportés : JPEG, PNG, WebP, GIF
- Taille max : 5 Mo

## Technical spec

### Endpoint Python (app.py)
```
POST /api/upload-background
Content-Type: multipart/form-data
Body: file=<image>
```
Répond 200 OK `{"ok": true}` ou 400 avec message d'erreur.

### Frontend (setup/templates/index.html)
- Upload via `fetch('/api/upload-background', FormData)` avant `startInstall()`
- Preview `<img>` mis à jour via `FileReader.readAsDataURL`
- Si pas de fichier sélectionné : skip silencieux (image existante conservée)

## Impact on existing code

- `setup/app.py` : ajout route `/api/upload-background` + import `werkzeug` ou `io`
- `setup/templates/index.html` : section Configuration enrichie
