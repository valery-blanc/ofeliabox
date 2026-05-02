# BUG-013 — Digistorm : npm install échoue (exit code 254) — source incomplète

**Status:** FIXED  
**Date:** 2026-05-01

## Symptom

`docker compose up --build` échoue avec :
`target digistorm: failed to solve: process "/bin/sh -c npm install" did not complete successfully: exit code: 254`

## Root cause

Le repo git ne contient que deux fichiers custom (`digistorm/src/renderer/app.js` et
`digistorm/src/server/index.js`). Le `package.json` et la source complète de Digistorm
ne sont pas versionnés (taille trop importante). Sans `package.json`, `npm install`
échoue.

Codeberg bloque `git clone` depuis un build Docker (`RUN git clone`), d'où l'approche
de copier la source en amont.

## Fix applied

`setup/app.py` : ajout de la fonction `_prepare_digistorm()` appelée avant
`docker compose build`. Elle clone la source Digistorm depuis Codeberg
(`https://codeberg.org/ladigitale/digistorm`) dans un répertoire temp, copie
les fichiers manquants dans `digistorm/src/` en préservant les fichiers custom
d'Ofelia (ne pas écraser les fichiers existants).

## Spec section impacted

`docs/specs/specs_keebee.md` — section Digistorm / Installation
