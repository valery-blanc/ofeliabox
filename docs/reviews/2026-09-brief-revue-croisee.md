# Brief de revue croisée BibliOfelia ⇄ keebee — septembre 2026

> **Ce qu'est ce document.** Le cadrage de la revue croisée des 10 et 11 septembre
> 2026. Il vivait dans un dépôt d'assemblage temporaire, `C:\WORK\_review-ofelia`,
> supprimé depuis : le texte ci-dessous décrit donc ce dépôt au présent, alors
> qu'il n'existe plus. Archivé ici parce qu'il se reconstruit mal de mémoire.
>
> **Ce qu'il a produit.** Huit constats, quatre de chaque côté :
> BUG-045 à BUG-048 dans ce dépôt (mots de passe jamais générés par `install.sh`,
> `.env.example` incomplet, sauvegarde/restauration incohérentes, secrets exposés
> par l'assistant) et BUG-045 à BUG-048 côté BibliOfelia (entrypoint de prod sans
> `setup_roles` ni `setup_schedules`, restauration qui rejouait le journal WAL,
> `/health` toujours à `null`, archives de sauvegarde non autonomes). Plus, en
> cascade, la **réconciliation de `box-durcissement-2026-08`** dans `master`.
>
> **Comment le réutiliser.** Reconstituer un dépôt d'assemblage, y copier le code
> des deux projets et ce fichier en `CLAUDE.md`, puis lancer la revue. Deux
> sections font le travail : « Où chercher en priorité », qui oriente vers le
> couplage entre les deux projets, et surtout **« Décisions délibérées — ne pas les
> signaler comme des défauts »**, qui évite de redécouvrir des arbitrages déjà
> rendus. À tenir à jour : `/biblio/` appartient toujours à Koha dans le texte,
> mais Koha, PMB et SLiMS ont été désinstallés de la Box depuis (FEAT-030).
>
> ⚠️ La revue a aussi montré les limites d'un tel diff : elle a conclu à tort que
> l'absence de `setup_roles` faisait échouer toutes les vues protégées, alors que
> celles-ci passent par `require_role` et non par les permissions Django. **Un
> constat se vérifie sur la machine avant d'être cru.**

---

# Dépôt de revue — projet Ofelia (BibliOfelia + keebee)

Ce dépôt est **artificiel** : il assemble le code applicatif de deux dépôts réels pour
permettre **une revue unique et croisée**. Il n'est pas déployé, il n'est pas buildé, il
n'a pas d'historique. Le code apparaît comme « ajouté » sur la branche `revue` — c'est
voulu : **le diff, c'est le code à réviser**, pas un changement récent.

## ⚠️ Lire au-delà du diff

Le diff de `revue` ne porte que **56 fichiers** : le périmètre choisi pour cette revue
(couplage entre les deux projets, déploiement, sauvegardes, contrat d'API, argent, prêts).

**Le reste du code des deux projets est déjà présent dans le dépôt**, au commit de base :
toutes les autres applications Django, les gabarits, les 87 fichiers de tests, les deux
specs. Ce code n'est pas « hors sujet », il est **hors diff** — il est là exprès pour être
consulté. Quand une fonction du périmètre appelle quelque chose qui n'est pas dans le diff,
**ouvrez le fichier** : la réponse est dans le dépôt. Un constat qui dit « impossible de
vérifier, l'appelant n'est pas dans le diff » est un constat perdu.

Ne signalez en revanche des défauts **que sur les fichiers du diff** — le reste est du
contexte, pas la cible.

| Ici | Dépôt réel | Rôle |
|---|---|---|
| `bibliofelia/` | `valery-blanc/BibliOfelia` | Logiciel de gestion de bibliothèque hors-ligne (Django 5.1) |
| `keebee/` | `valery-blanc/ofeliabox` | La « Ofelia Box » : l'hôte qui fait tourner BibliOfelia **et** les autres applis |

Les chemins des constats se transposent 1:1 vers les vrais dépôts (`bibliofelia/apps/...`
→ `C:\WORK\BibliOfelia\apps\...`, `keebee/nginx/...` → `C:\WORK\keebee\nginx\...`).

## Le système en une page

**Ofelia** équipe des bibliothèques et des écoles **sans connexion internet fiable**, dans
des sites distants, **sans personne pour faire de la maintenance sur place**.

La **Ofelia Box** est un Raspberry Pi 5 (`keebee/`) qui héberge en Docker, derrière un seul
nginx, un ensemble d'applications hors-ligne : Koha, PMB, SLIMS, Moodle, Kolibri, Kiwix
(Wikipédia/Wikisource), Calibre-Web, Digistorm — **et BibliOfelia**. Un wizard de setup
(`keebee/setup/app.py`) configure la Box au premier démarrage ; un portail
(`keebee/portal/index.html`) sert de page d'accueil ; un healthcheck surveille l'ensemble.

**BibliOfelia** (`bibliofelia/`) est l'application de gestion de bibliothèque :
catalogage (dont scan de codes-barres à la caméra), exemplaires, usagers, prêts/retours,
caisse et bouclement, récolement, impression d'étiquettes et de cartes, rapports, sauvegardes.
Stack : **Django 5.1 LTS + SQLite (WAL) + DRF + django-q2 + HTMX + Alpine + Pico.css**, en Docker.
Interface en **4 langues** (fr, en, es, mg — français langue source).

**Deux cibles de déploiement**, à garder en tête en permanence :

1. **La Box** (Pi 5, hors-ligne) — BibliOfelia sous le préfixe d'URL `/bibliofelia/`, routé
   par le nginx de `keebee/`, en cohabitation avec les autres applis. C'est le cas d'usage
   qui compte : coupures de courant, carte SD, pas d'internet, pas d'admin sur place.
2. **Des instances hébergées** (`bibliofelia.org`, derrière Traefik) — mono-instance par
   bibliothèque, avec un nom de domaine, pour les sites qui ont du réseau.

Le code doit fonctionner dans les deux cas : **préfixe d'URL variable**, pas d'URL absolue
en dur, `CSRF_TRUSTED_ORIGINS` et `FORCE_SCRIPT_NAME` corrects, aucun appel réseau sortant
obligatoire.

## Le périmètre sous revue (le diff)

56 fichiers, ~7 600 lignes, choisis parce que ce sont les zones **sans filet** : peu ou pas
de tests automatisés, un déploiement sur une machine que personne ne dépanne, et de
l'argent.

| Groupe | Ce qu'on y cherche |
|---|---|
| `keebee/nginx/*`, les deux `docker-compose.yml`, `keebee/healthcheck/app.py` | Cohérence du routage et de l'orchestration entre les deux projets |
| `keebee/scripts/*.sh`, `bibliofelia/scripts/*.sh`, `apps/tasks/` | Installation, sauvegarde, **restauration** : perte ou écrasement de données |
| `keebee/setup/app.py` | Le wizard qui configure la Box au premier démarrage, BibliOfelia compris |
| `bibliofelia/config/settings/*`, `config/urls.py`, `deploy/avignon/instance-nginx.conf` | Montage sous préfixe, CSRF, proxy, statiques — dans les **deux** cibles de déploiement |
| `bibliofelia/apps/core/{middleware,timeutils,search,context_processors}.py` | Proxy, fuseau horaire, **FTS5 (SQL construit à la main)** |
| `bibliofelia/apps/api/*` | Le contrat consommé par OfeliaScan |
| `bibliofelia/apps/finance/*`, `apps/closing/*` | Caisse et bouclement : arrondis, doubles comptages, transactions |
| `bibliofelia/apps/loans/{services,models}.py` | Prêts, retours, échéances |

## Où chercher en priorité

1. **Le couplage `bibliofelia/` ⇄ `keebee/`** — c'est la raison d'être de cette revue, et
   c'est là que les régressions ont fait le plus mal :
   - routage nginx (`keebee/nginx/conf.d/edubox.conf`, `ofelia-locations.inc`, `proxy_params`)
     vs ce que Django attend (`bibliofelia/config/settings/*`, `config/urls.py`) : préfixe,
     en-têtes proxy, `X-Forwarded-*`, cache, statiques, WebSocket éventuels ;
   - ⚠️ **`/biblio/` est pris par Koha** — BibliOfelia est sous **`/bibliofelia/`**. Toute
     confusion entre les deux est un bug ;
   - les deux `docker-compose.yml` : réseaux, volumes, `depends_on`, `restart`, variables
     d'environnement, fuseau horaire (`TZ`), ordre de démarrage ;
   - le wizard (`keebee/setup/app.py`) et le portail : ce qu'ils supposent de BibliOfelia
     (URL, santé, identifiants) et si BibliOfelia le fournit vraiment.
2. **Robustesse en site distant sans maintenance** — c'est la priorité n°1 du projet, avant
   l'élégance : que se passe-t-il à la coupure de courant en pleine écriture, si la carte SD
   se dégrade, si une migration échoue au boot, si un conteneur redémarre en boucle, si le
   disque est plein ? Voir `bibliofelia/scripts/entrypoint.sh`, `apps/tasks/backup.py`,
   `scripts/backup.sh` / `restore.sh`, et leurs équivalents `keebee/scripts/`.
3. **Correction métier** — prêts/retours et dates d'échéance, caisse et bouclement (argent :
   arrondis, doubles comptages, transactions), récolement, tombstones de codes, import/export
   Excel, rapports.
4. **Concurrence SQLite** — un seul fichier, mode WAL, un worker django-q2 en parallèle du web.
   Transactions trop longues, `ATOMIC_REQUESTS` vs `non_atomic_requests`, verrous, retries.
5. **i18n** — chaînes françaises en dur sans `{% trans %}` / `_()`, échappement HTML dans les
   chaînes traduites, langue active dans le worker et dans les PDF, pluriels, formats de date.
6. **Sécurité** — authentification et permissions par rôle, CSRF derrière le proxy, uploads,
   requêtes SQL construites à la main (notamment autour de la recherche **FTS5**), secrets en
   dur, endpoints DRF exposés.
7. **Impression et PDF** — étiquettes de dos, cartes usagers (Brother QL-810W, ruban 62 mm),
   sous-ensembles de polices, largeurs calculées.

## Décisions délibérées — ne pas les signaler comme des défauts

Ces points ont été tranchés en connaissance de cause. Un constat qui les « corrige » est un
faux positif ; en revanche, un code qui **les contredit** est un vrai constat.

- **`/admin/` Django est réservé** au superadmin et au débogage. Ce n'est jamais l'interface
  des bibliothécaires — inutile de réclamer son ergonomie ou son durcissement UX.
- **Petite bibliothèque : simplicité > exhaustivité.** `CASCADE` et actions simples sont
  préférés à `SET_NULL` + filtrage défensif partout. Ne pas réclamer de la généralité.
- **Aucune dépendance CDN** : tout est servi en local (contrainte hors-ligne). Les libs
  minifiées vendues (`static/js/*.min.js`) ont été **exclues de cette revue** exprès.
- **Un identifiant imprimé physiquement n'est jamais réattribué** (étiquette, carte) :
  les tombstones sont voulus.
- **OfeliaScan** (application de scan Android, hors de ce dépôt) est **la source de vérité du
  contrat d'API** : si le code Django et ce client divergent, c'est la spec Django qui a tort.
- Le scan passe **par la caméra du navigateur d'abord**, OfeliaScan en repli automatique.
- Le français est la **langue source** ; les `.po`/`.mo` sont exclus de cette revue.
- **Limites connues, déjà arbitrées** (inutile de les redécouvrir) : le volume `/backup` de la
  Box n'est pas monté sur l'hôte (sauvegardes perdues au rebuild, correctif différé) ;
  l'adresse IP de la Box n'est pas fixe (plusieurs interfaces, `canaima.local`) ;
  le Pi 5 ne se réveille pas par Wake-on-LAN.

## Ce qui a été volontairement laissé hors du bundle

Pour concentrer la revue sur du code : la documentation (sauf les deux specs ci-dessous), le
guide utilisateur et ses captures, les images, polices et binaires, les catalogues de
traduction, les bibliothèques JS/CSS minifiées vendues, et les migrations Django purement
structurelles — **les migrations qui portent de la logique (`RunPython`/`RunSQL`) sont, elles,
incluses**.

Deux documents de référence sont fournis parce qu'ils sont la source de vérité du
comportement attendu — **tout écart entre eux et le code est un constat qui mérite d'être
signalé** :

- `bibliofelia/docs/specs/SPEC_BIBLIOFELIA.md`
- `keebee/docs/specs/specs_keebee.md`

Les consignes de travail propres à chaque projet restent dans `bibliofelia/CLAUDE.md` et
`keebee/CLAUDE.md`. Elles décrivent le workflow de développement réel (documentation
obligatoire, gate i18n, déploiement) — utiles pour comprendre les conventions, sans objet
pour la revue elle-même.
