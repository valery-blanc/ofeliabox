# BUG-045 — `install.sh` n'a jamais généré de mots de passe, et affichait le `.env`

**Statut** : FIXED 2026-09-10
**Composant** : `scripts/install.sh`, `.env.example`
**Origine** : revue croisée BibliOfelia ⇄ keebee (dépôt `_review-ofelia`)

## Symptôme

`sudo bash install.sh` sur un Pi neuf affiche « .env créé avec mots de passe
générés automatiquement », puis déverse le fichier complet sur la sortie
standard. Les mots de passe qu'il annonce n'ont pourtant pas été générés :
ce sont ceux du dépôt public.

## Cause racine

Trois défauts cumulés, dont deux se masquaient l'un l'autre.

**1. Les huit `sed` étaient des no-op silencieux.**
Le script copiait `.env.example` puis remplaçait des marqueurs
`CHANGE_ME_MARIADB`, `CHANGE_ME_MOODLE_DB`, `CHANGE_ME_KOHA`, `CHANGE_ME_PMB`,
`CHANGE_ME_SLIMS`, `CHANGE_ME_REDIS`, `CHANGE_ME_SESSION`…
**qui n'existent pas dans le gabarit.** Celui-ci porte `CHANGE_ME_root`,
`CHANGE_ME_moodle`, `CHANGE_ME_admin`, `CHANGE_ME_koha`, `CHANGE_ME_gate`,
`CHANGE_ME_selfcheck`. `sed` ne remplace rien et sort avec 0 : aucune erreur,
aucun avertissement. La Box démarrait avec `MARIADB_ROOT_PASS=CHANGE_ME_root`.

**2. `REPO_URL` était un gabarit.**
`https://github.com/VOTRE_ORG/keebee.git` — le `git clone` de l'étape 3 renvoie
404. C'est ce qui a longtemps caché le défaut n° 1 : personne n'allait jusqu'à
l'étape 4.

**3. `cat "$EDUBOX_DIR/.env"`.**
Une installation se lance sous `tee`, dans une session SSH que le client
enregistre, ou depuis un wrapper qui journalise. Tous les secrets de la Box —
root MariaDB, admin Moodle, Koha, PMB, SLiMS, Redis, clé de session Digistorm,
clé Django de BibliOfelia — atterrissaient dans ce flux.

## Fix appliqué

`scripts/install.sh` **écrit** le `.env` au lieu de le gabariter :

- une fonction `gen()` (`openssl rand | tr -dc | cut -c1-N` — `cut` et non
  `head -c`, qui ferme le tube et fait échouer la commande sous `pipefail`) ;
- un `cat > .env <<EOF` d'un bloc listant les **17 secrets**, alignés sur
  `setup/app.py::_write_env`, qui reste le chemin d'installation normal ;
- `umask 077` + `chmod 600` sur le fichier ;
- plus aucun `cat` : le script indique le chemin et la commande pour lire les
  mots de passe (`sudo cat /opt/edubox/.env`) ;
- `REPO_URL` pointe sur `valery-blanc/ofeliabox`, et reste surchargeable par
  l'environnement.

Il n'y a plus de substitution de marqueurs : la classe de bug entière disparaît.

## Ce qui reste à décider

`setup/app.py::_write_env` écrit lui aussi le `.env` **sans `chmod 600`**.
Le fichier hérite du umask du service — à vérifier sur la Box
(`stat -c %a /opt/edubox/.env`) et à durcir si besoin.

## Section de spec

`specs_keebee.md` §12 (script de déploiement principal), §6.1 (approche
d'installation).
