# BUG-022 — Kolibri : import Khan Academy échoue silencieusement

**Status:** FIXED
**Date:** 2026-05-02

## Symptom

Après avoir coché "Khan Academy Español" dans le wizard et lancé l'installation,
Kolibri démarre mais la chaîne Khan Academy n'est pas visible dans l'interface.

## Root cause

L'import Kolibri (`kolibri manage importchannel/importcontent`) était lancé
immédiatement après `docker compose up -d`, sans attendre que Kolibri soit
complètement initialisé et healthy.

Kolibri a un `start_period: 60s` dans son healthcheck mais peut prendre
2-3 minutes à être prêt sur un Pi. Si l'import commence trop tôt,
`docker exec` échoue ou Kolibri refuse la connexion au serveur de contenu.

L'erreur était capturée mais affichée en `⚠️` dans la console, sans arrêter
le flux SSE — l'utilisateur pouvait ne pas la voir.

## Fix applied

Ajout de `_wait_for_healthy("edubox-kolibri")` avant l'import, avec
timeout de 300 secondes. Si Kolibri n'est pas sain après 5 min → log d'erreur
explicite et import skippé.

Amélioration du message d'erreur : les erreurs stderr sont maintenant affichées
complètes (non tronquées à 200 chars) et en rouge dans la console.

## Spec section impacted

Section 4.2 (Kolibri) de specs_keebee.md — note sur attente healthcheck
