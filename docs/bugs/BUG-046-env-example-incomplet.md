# BUG-046 — `.env.example` ne déclarait que 6 des 18 variables

**Statut** : FIXED 2026-09-10
**Composant** : `.env.example`
**Origine** : revue croisée BibliOfelia ⇄ keebee (dépôt `_review-ofelia`)

## Symptôme

Une installation manuelle (`cp .env.example .env` puis `docker compose up -d`,
le chemin décrit par le README) démarre une Box en partie inerte :
Redis refuse de se lancer, BibliOfelia redémarre en boucle, et les comptes
d'administration de Koha, PMB et SLiMS sont créés **sans mot de passe**.

## Cause racine

`.env.example` listait 6 clés. `docker-compose.yml` en consomme 13 par
`${…}`, et `setup/app.py::_write_env` en écrit 18.

Manquaient : `KOHA_ADMIN_PASS`, `REDIS_PASS`, `DIGISTORM_SESSION_KEY`,
`PMB_DB_PASS`, `PMB_ADMIN_PASS`, `SLIMS_DB_PASS`, `SLIMS_ADMIN_PASS`,
`BIBLIOFELIA_SECRET_KEY`, `CALIBRE_ADMIN_PASS`, `AP_PASS`, `BOX_NAME`.

**Une variable absente ne provoque aucune erreur** : Compose substitue une
chaîne vide et démarre. D'où :

| Service | Avec la variable vide |
|---|---|
| `edubox-redis` | `redis-server --requirepass ''` → refus au démarrage |
| `edubox-bibliofelia` | `SECRET_KEY=''` → Django refuse de démarrer |
| `edubox-digistorm` | pas de clé de session |
| Koha / PMB / SLiMS | compte admin initialisé sans mot de passe |
| Point d'accès Wi-Fi | pas de PSK |

Seule l'installation par l'assistant échappait à tout ça, parce que
`_write_env` écrit le fichier de zéro sans jamais lire le gabarit.

## Fix appliqué

`.env.example` réécrit avec les **18 clés**, groupées par application,
commentées, plus `BIBLIOFELIA_CSRF_TRUSTED_ORIGINS` (facultative). L'en-tête
dit explicitement que ce fichier ne sert qu'à l'installation manuelle, que les
deux chemins normaux (assistant, `install.sh`) l'écrivent eux-mêmes, et que la
liste doit rester alignée sur ces trois sources.

## Section de spec

`specs_keebee.md` §11 (Docker Compose complet).
