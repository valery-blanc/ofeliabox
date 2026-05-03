# FEAT-020 — Refonte visuelle du portail (Claude Design)

**Status:** DONE  
**Date:** 2026-05-03  

## Contexte

Le portail précédent avait un thème dark générique (navy/slate, `-apple-system`).
Un nouveau design a été créé dans Claude Design (claude.ai/design), exporté comme
bundle HTML autonome : `ofelia-design-system/project/ui_kits/portal/OFELIA-portal-standalone.html`.

## Ce qui a changé

### Visuel
- **Thème** : chaud burgogne/crème (remplace le dark navy)
- **Palette** : `--burgundy #6B2138`, `--orange #ED7538`, `--amber #F3B84C`, `--sky #B7D9FF`, `--blush #F4BABA`, `--olive #D1C360`, `--green #3D8C5A`
- **Typographie** : Bricolage Grotesque (titres/brand) + DM Sans (body) via Google Fonts CDN → fallback `system-ui` si offline
- **Cards** : fond solid couleur par app (plus de fond blanc avec icône colorée)
  - Couleurs light (amber, sky, olive, blush) → texte dark
  - Couleurs dark (burgundy, orange, green) → texte blanc
- **Nav** : sticky blanche — logo OFELIA à gauche + tagline + sélecteur de langue à droite
- **Footer** : fond burgogne — logo + copyright + sélecteur de langue
- **Background** : photo "enfant avec globe" (`assets/bg.png`, 650 KB)
- **Logo** : logo OFELIA officiel (`assets/logo.png`, 86 KB)

### Technique
- **Réécriture vanilla JS** — le prototype source utilisait React/Babel CDN (non viable offline). Réimplémenté en JS pur sans dépendance CDN critique.
- **Nouveaux assets** : `portal/assets/bg.png`, `portal/assets/logo.png`

## Ce qui est conservé

- Fetch `/wizard-state.json` → masquer les tuiles non installées (même logique, mêmes IDs)
- Fetch `/api/status` → badges de statut dot, polling toutes les 30s
- i18n 6 langues : fr/en/es/pt/it/de (même objet i18n, même clé `localStorage`)
- Tuile Calibre (`card-calibre`, visible si `state.calibre === true`)
- Tuile Identifiants (`/credentials.html`)

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `portal/index.html` | Réécriture complète |
| `portal/assets/bg.png` | Nouveau — photo enfant avec globe (650 KB) |
| `portal/assets/logo.png` | Nouveau — logo OFELIA officiel (86 KB) |

Nginx / docker-compose : aucun changement.

## Déploiement

Fichiers statiques, pas de rebuild Docker :
```bash
scp portal/index.html portal/assets/bg.png portal/assets/logo.png Pi:/opt/edubox/portal/[...]
```
