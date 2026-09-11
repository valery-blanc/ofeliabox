# BUG-047 — Sauvegarde et restauration : base SQLite déchirée, `--exclude` inopérant, répertoires non purgés

**Statut** : FIXED 2026-09-10
**Composant** : `scripts/backup.sh`, `scripts/edubox-backup.sh`, `scripts/restore.sh`
**Origine** : revue croisée BibliOfelia ⇄ keebee (dépôt `_review-ofelia`)

## Symptôme

Trois défauts sur la même chaîne. Aucun ne se voit au moment de la sauvegarde ;
tous se découvrent le jour où l'on restaure.

1. Après restauration, BibliOfelia perd des prêts et des paiements récents, ou
   répond `database disk image is malformed` et redémarre en boucle.
2. La sauvegarde périodique « hors Kolibri », lancée toutes les 6 h par le timer
   systemd, écrit en réalité des dizaines de gigaoctets sur la carte SD.
3. `restore.sh --date …` affiche « Restauration terminée » sur une Box qui n'est
   revenue qu'à moitié à la date demandée.

## Cause racine

### 1. `tar` d'une base SQLite vivante

`tar -czf … -C "$DATA_DIR" .` archivait `bibliofelia/data/bibliofelia.sqlite3`
et ses journaux `-wal` / `-shm` **pendant que gunicorn et le worker
écrivaient**. `tar` lit chaque fichier à un instant différent : si le fichier
principal est lu après un checkpoint et le `-wal` avant la transaction
suivante, l'archive est déchirée. BibliOfelia utilise pour cette raison
`sqlite3.Connection.backup()` dans `apps/tasks/backup.py` ; la sauvegarde de la
Box, elle, copiait les octets à chaud.

Le datadir MariaDB était dans le même cas : une copie à chaud d'InnoDB n'est pas
restaurable. Le dump `mysqldump --single-transaction` de l'étape 1 en est la
vraie sauvegarde — le datadir faisait doublon **et** donnait une fausse
impression de sécurité.

### 2. `--exclude` comparé au mauvais nom

```bash
tar -czf … --exclude="$DATA_DIR/kolibri" -C "$DATA_DIR" .
```

`tar` compare ses motifs `--exclude` au **nom du membre dans l'archive**
(`./kolibri/…`), pas au chemin absolu sur le disque. Le motif
`/opt/edubox/data/kolibri` ne correspondait donc à rien : Kolibri était inclus,
malgré le nom du script et son message « hors Kolibri ». Sur la Box, cela veut
dire toute la bibliothèque Khan Academy réécrite sur la carte SD toutes les six
heures.

### 3. Répertoires non purgés à la restauration

La boucle de purge de `restore.sh` listait `moodle koha pmb slims digistorm
portainer`. **`bibliofelia` et `mariadb` en étaient absents.** Le `tar -xzf`
écrase bien ce qu'il contient, mais tout fichier créé **après** la date du
backup survivait et se mélangeait au reste. Pour BibliOfelia, le pire cas :
la base de T0 réinstallée à côté d'un journal `-wal` de maintenant, que SQLite
rejoue par-dessus à la réouverture.

## Fix appliqué

**`backup.sh` et `edubox-backup.sh`** (mêmes correctifs des deux côtés) :

- nouvelle étape : instantané cohérent avant l'archive —
  `docker exec edubox-bibliofelia sqlite3 /app/data/bibliofelia.sqlite3
  ".backup '/app/data/bibliofelia-snapshot.sqlite3'"`. Le fichier atterrit dans
  le bind-mount `/opt/edubox/data/bibliofelia/data`, donc dans l'archive.
  Conteneur arrêté ou base absente → avertissement explicite, pas d'échec ;
- `--exclude` corrigés en chemins relatifs à l'archive (`./kolibri`), et
  ajoutés pour `./mariadb` et pour les trois fichiers de la base vivante.

**`restore.sh`** :

- `bibliofelia/media` rejoint la liste des répertoires purgés ;
- `bibliofelia/data` et `mariadb` sont **mis de côté** (`mv` vers
  `<dir>.before-restore-<date>`) et non supprimés : sur un site distant, une
  restauration qui échoue en cours de route doit rester réversible. Le script
  rappelle en fin de course où ils sont et comment les effacer ;
- l'instantané `bibliofelia-snapshot.sqlite3` est remis en place sous son vrai
  nom, et les journaux `-wal` / `-shm` supprimés ;
- MariaDB repart d'un datadir vide : l'image le réinitialise, puis le dump SQL
  est chargé par-dessus — c'est la séquence correcte, et elle n'est plus polluée
  par un datadir hérité.

## Limite connue, non corrigée ici

Le dump `--all-databases` restaure aussi `mysql.user` : après restauration, les
mots de passe MariaDB redeviennent ceux du jour du backup, et le compte
`healthcheck` créé par l'image à sa première initialisation **disparaît** — la
base fonctionne mais son contrôle de santé échoue, ce qui bloque Moodle.
Constaté le 2026-08-26 lors du remontage de la Box. `restore.sh` affiche
désormais la marche à suivre en fin de restauration ; le correctif de fond
(recréer le compte depuis `/var/lib/mysql/.my-healthcheck.cnf`) reste à faire.

## Section de spec

`specs_keebee.md` §10.2 (scripts de sauvegarde et restauration).
