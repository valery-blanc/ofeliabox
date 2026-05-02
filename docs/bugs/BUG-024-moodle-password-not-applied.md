# BUG-024 — Mot de passe Moodle du wizard non appliqué à la BDD

**Status:** FIXED
**Date:** 2026-05-02

## Symptom

L'utilisateur choisit "Ofelia2016" comme mot de passe Moodle dans le wizard.
Le wizard écrit `MOODLE_ADMIN_PASS=Ofelia2016` dans `.env` et dans
`credentials-data.json`. Mais le login Moodle exige l'ancien mot de passe
(`vfeJt38uKwSKZKgnEduBox!`).

De plus, la page `/credentials.html` affiche les valeurs codées en dur
pour Koha, PMB et SLiMS au lieu des valeurs générées par le wizard.

## Root cause

**Problème 1 — Moodle password :**
L'env var `MOODLE_PASSWORD` n'est utilisée par `erseco/alpine-moodle` que
lors du premier démarrage (initialisation de la BDD). Sur une installation
existante, changer cette variable n'a aucun effet sur la BDD Moodle.

**Problème 2 — credentials.html :**
Seul l'élément `[data-cred="moodle.password"]` était dynamique.
Les blocs Koha, PMB, SLiMS et Kolibri utilisaient des valeurs hardcodées
sans attribut `data-cred`. La requête `fetch('/credentials-data.json')` 
échouait probablement car nginx ne servait pas les fichiers JSON.

## Fix applied

1. **app.py** : après `docker compose up -d`, si moodle est dans les services
   et un mot de passe est fourni, appel de :
   `docker exec edubox-moodle php admin/cli/reset_password.php --username=admin --password=XXX`
   après attente que Moodle soit healthy.

2. **credentials.html** : ajout d'attributs `data-cred` sur tous les champs
   dynamiques (koha.user, koha.password, pmb.user, pmb.password,
   slims.user, slims.password, kolibri.user).

3. **nginx** : ajout d'un `location ~ ^/[^/]+\.json$` pour servir
   `credentials-data.json` et `wizard-state.json` depuis le répertoire portal.

## Spec section impacted

Section 8.3 (Setup Wizard — credentials) de specs_keebee.md
