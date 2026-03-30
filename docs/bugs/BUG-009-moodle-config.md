---
id: BUG-009
title: Moodle — 3 bugs config (CORS wwwroot, mot de passe admin, site name)
status: FIXED
date: 2026-03-30
---

## Bug 1 — CORS sur toutes les pages Moodle

### Symptôme
"Blocage d'une requête multiorigine (Cross-Origin Request)" sur toutes les pages Moodle
(http://192.168.0.147/moodle/my/).

### Cause
`$CFG->wwwroot = 'http://localhost'` dans `config.php`. Moodle génère des URLs de ressources
(CSS, JS, images) en `http://localhost/moodle/…`. Le navigateur est connecté via
`http://192.168.0.147/` → mismatch de host → CORS.

### Fix
`config.php` — wwwroot dynamique :
```php
$CFG->wwwroot = 'http://' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '192.168.0.147') . '/moodle';
$CFG->reverseproxy = true;
```
Fonctionne pour accès local (192.168.0.147), ZeroTier (10.115.169.147), ou tout autre hostname.
Le fallback `192.168.0.147` est utilisé lors des opérations CLI (cron, install_langpack, etc.).

---

## Bug 2 — Mot de passe admin cassé

### Symptôme
`vfeJt38uKwSKZKgnEduBox!` refusé sur la page de login Moodle.

### Cause racine (2 problèmes cumulés)
1. **`policyagreed=0`** dans `mdl_user` — bloquait la session après authentification.
2. **Hash type incorrect** — quand le mot de passe est passé via `--password='...'` sur SSH,
   le `!` dans le mot de passe déclenche l'expansion d'historique bash, corrompant le mot de passe.
   Résultat : le hash `$6$` stocké ne correspond pas au bon mot de passe.

### Fix
1. Corriger `policyagreed` :
```sql
UPDATE mdl_user SET policyagreed=1 WHERE username='admin';
```
2. Réinitialiser le mot de passe via un script PHP (pas via SSH + `--password=` pour éviter l'expansion `!`) :
```php
<?php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
$user = $DB->get_record('user', ['username' => 'admin']);
$hash = hash_internal_user_password('vfeJt38uKwSKZKgnEduBox!');
$DB->set_field('user', 'password', $hash, ['id' => $user->id]);
```
```bash
# Copier le script puis l'exécuter dans le container
scp reset_pw.php pi:/tmp/
docker cp /tmp/reset_pw.php edubox-moodle:/tmp/
docker exec edubox-moodle php /tmp/reset_pw.php
```

### À retenir
- Ne jamais passer un mot de passe contenant `!` via `--password='...'` en SSH (expansion d'historique bash).
- Toujours utiliser un script PHP copié par `scp` + `docker cp`.
- Vérifier `policyagreed=1` dans `mdl_user` pour les comptes admin nouvellement créés.

---

## Bug 3 — Site name "Dockerized_Moodle"

### Symptôme
Page de login : "Connexion à Dockerized_Moodle" au lieu de "Connexion à Moodle".

### Cause
`MOODLE_SITE_NAME` dans docker-compose n'est pas appliqué si Moodle est déjà installé.
Le nom vient de `mdl_course.fullname` pour `id=1` (le "cours" site).

### Fix
```sql
UPDATE mdl_course SET fullname='Moodle', shortname='moodle' WHERE id=1;
```
