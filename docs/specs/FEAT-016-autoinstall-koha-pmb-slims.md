# FEAT-016 — Auto-installation Koha / PMB / SLiMS sans interface web

**Statut** : EN COURS  
**Date** : 2026-05-02  
**Contexte** : FEAT-013 (Setup Wizard)

---

## Problème

Après le wizard d'installation, trois applications nécessitaient une
intervention manuelle via leur interface web :

- **Koha** : wizard `/cgi-bin/koha/installer/install.pl` (schéma SQL + compte superlibrarian)
- **PMB** : wizard web (`/pmb/tables/`) — schéma SQL + mot de passe admin
- **SLiMS** : wizard web (`/slims/install/`) — schéma SQL

Cela rendait le déploiement non entièrement automatisable via le wizard Ofelia.

---

## Solution

Chaque container gère son propre setup au démarrage via un **entrypoint.sh**
idempotent (marqueur `.pmb_initialized` / `.slims_initialized`, check table count
pour Koha).

### PMB — `pmb/entrypoint.sh`

1. Attend MariaDB
2. Écrit `includes/config_local.inc.php` avec les credentials DB (inclus par `config.inc.php`)
3. Si schéma absent (< 5 tables) :
   - Importe `tables/bibli_structure.sql` (schéma)
   - Importe `tables/data_global.sql` (données globales)
   - Importe `tables/data_ES.sql` (locale ES, fallback FR puis EN)
4. Met à jour le mot de passe admin via `UPDATE users SET mdp=MD5(...)`
5. Lance `apache2-foreground`

Mot de passe admin : variable `PMB_ADMIN_PASS` (générée par le wizard).

### SLiMS — `slims/entrypoint.sh`

1. Attend MariaDB
2. Écrit `config/sysconfig.php` avec les constants DB (`define(...)`)
3. Si schéma absent (< 5 tables) :
   - Importe `install/sql/structure_and_data.sql` (schéma + données SLiMS 9.7.2)
4. Met à jour le mot de passe admin via `UPDATE user SET passwd=MD5(...)`
5. Lance `apache2-foreground`

Mot de passe admin : variable `SLIMS_ADMIN_PASS` (générée par le wizard).

### Koha — `koha/entrypoint.sh` (ajout)

Après la configuration Apache (a2ensite), avant koha-plack :

1. Vérifie si la table `systempreferences` existe
2. Si absente :
   - Importe `/usr/share/koha/intranet/cgi-bin/installer/data/mysql/kohastructure.sql`
   - Importe tous les `*.sql` de `mandatory/`
3. Si aucun superlibrarian (flags & 1 = 1) :
   - Exécute `koha/setup-admin.pl` via Perl avec KOHA_CONF + PERL5LIB
   - Crée branche MAIN, catégorie S, patron superlibrarian `koha_admin`

Mot de passe admin : variable `KOHA_ADMIN_PASS` (générée par le wizard).

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `pmb/entrypoint.sh` | Nouveau — setup DB + Apache |
| `pmb/Dockerfile` | Ajout `default-mysql-client`, ENTRYPOINT |
| `slims/entrypoint.sh` | Nouveau — setup DB + Apache |
| `slims/Dockerfile` | Ajout `default-mysql-client`, ENTRYPOINT |
| `koha/setup-admin.pl` | Nouveau — script Perl superlibrarian |
| `koha/Dockerfile` | COPY setup-admin.pl |
| `koha/entrypoint.sh` | Ajout bloc schema + admin |
| `setup/app.py` | `_write_env()` : +3 passwords; `_write_credentials()` : vrais mots de passe |
| `docker-compose.yml` | KOHA/PMB/SLIMS_ADMIN_PASS passés aux containers |

---

## Credentials générés

Après le wizard :

| App | Login | Mot de passe |
|---|---|---|
| Koha | `koha_admin` | `KOHA_ADMIN_PASS` (aléatoire) |
| PMB | `admin` | `PMB_ADMIN_PASS` (aléatoire) |
| SLiMS | `admin` | `SLIMS_ADMIN_PASS` (aléatoire) |

Tous visibles sur `/credentials.html`.

---

## Idempotence

- **PMB/SLiMS** : fichier marqueur `.pmb_initialized` / `.slims_initialized` dans le volume
  config. Créé après le premier setup, empêche la réexécution.
- **Koha** : check `systempreferences` table et `COUNT(*) FROM borrowers WHERE flags & 1 = 1`.
  Inoffensif si la table/l'admin existent déjà.

## Impact sur le Pi existant

Aucun : le Pi actuel a déjà Koha configuré (systempreferences existe, admin existe),
PMB configuré (tables présentes), SLiMS configuré. Les checks idempotents skippent tout.
