# BUG-048 — L'assistant expose des secrets : `.env` en 664 et mot de passe Wi-Fi publié

**Statut** : FIXED 2026-09-11, sur la version réconciliée — celle qui tourne
réellement sur la Box (voir « Portée »). Reste à déployer pour que la machine
en bénéficie : son `.env` est encore en 664 tant que le déploiement n'a pas eu
lieu.
**Composant** : `setup/app.py`
**Gravité** : le mot de passe du point d'accès est lisible sans authentification
par quiconque est connecté au réseau — y compris au hotspot qu'il protège.

## Symptôme

Rien de visible. C'est tout le problème : les deux défauts ci-dessous ne
produisent ni erreur, ni journal, ni ralentissement.

## Mesures faites sur la Box le 2026-09-10

```
$ sudo stat -c "%a %n" /opt/edubox/.env
664 /opt/edubox/.env                          ← lisible par TOUS les comptes

$ sudo stat -c "%a %n" /opt/edubox/portal/credentials-data.json
644 /opt/edubox/portal/credentials-data.json  ← idem

$ curl -s -o /dev/null -w "%{http_code}" http://localhost/wizard-state.json
200                                            ← servi PUBLIQUEMENT, sans auth
```

## Cause racine

### 1. Les fichiers de secrets sont écrits avec le umask du service

`_write_env()` et `_write_credentials()` utilisaient `open(path, "w")`, qui
applique le umask du processus — 022 pour un service systemd ordinaire, d'où
644/664. Le `.env` porte le mot de passe root de MariaDB, ceux des comptes
d'administration de Moodle, Koha, PMB et SLiMS, la clé de session Digistorm et
la clé Django de BibliOfelia. Sur une Box multi-utilisateurs, tous étaient
lisibles par n'importe quel compte.

### 2. Le mot de passe du Wi-Fi était publié sur le réseau

`_save_wizard_state()` écrivait `ap_pass` dans
`portal/wizard-state.json` — un fichier **servi par nginx sans
authentification**, parce que le portail le lit en JavaScript pour masquer les
tuiles des applications non installées.

Or **personne ne lisait ce champ** : le portail n'utilise que `apps`, `zims` et
`calibre` (`portal/index.html`, `applyWizardState`), et l'assistant relit le mot
de passe courant depuis nmcli (`_get_ap_pass`). C'était donc un secret publié
pour rien, à portée de toute personne connectée au réseau — dont les usagers du
hotspot que ce mot de passe protège.

Le fichier actuellement servi par la Box ne contient pas `ap_pass` : il a été
écrit par une version antérieure du code. **Le prochain passage de l'assistant
l'y aurait mis.**

## Fix appliqué

Nouvelle fonction `_write_secret_file(path, content)` :

- ouvre le descripteur **directement en 0600** (`os.open` + `O_CREAT`) plutôt
  que de faire un `chmod` après coup — entre la création et le `chmod` il
  existerait sinon un instant où le fichier est lisible ;
- repasse un `chmod` explicite, car `O_CREAT` ne modifie pas le mode d'un
  fichier **déjà existant** : c'est ce qui durcit les `.env` déjà en place.

Elle est utilisée par les **cinq** écritures de secrets de la version
réconciliée : deux pour le `.env` (`_write_env` et la configuration du point
d'accès) et trois pour `credentials-data.json` (`_write_credentials`,
`update_credentials`, et `/api/set-password` — ce dernier ne passe pas par
`_write_credentials`, c'est le plus facile à manquer).

Et `ap_pass` a été **retiré** de `_save_wizard_state` — ce fichier reste public,
il ne doit rien contenir de secret.

## Test

`scripts/test_secrets.py` (convention du dépôt : script autonome, comme
`test_stall_watch.py`). 15 vérifications, dont la plus importante : le mot de
passe Wi-Fi **n'apparaît nulle part** dans le fichier servi publiquement.

Vérifié le 2026-09-10 sur Fez, dans un conteneur Linux (les modes POSIX ne se
testent pas sous Windows) :

```
docker run --rm -v /tmp/kb:/kb python:3.12-slim \
    sh -c "pip install -q flask && python /kb/scripts/test_secrets.py"
```

**Tout est vert sur le code corrigé, 4 échecs sur le code d'avant** — dont
`.env en 0600 -> 644` et `le mot de passe Wi-Fi n'apparaît nulle part`. Un test
qui passe des deux côtés ne prouverait rien ; celui-ci rejette bien l'ancien
code.

## Portée — résolu par la réconciliation (2026-09-11)

Ce correctif avait d'abord été écrit contre le `setup/app.py` de `master`
(1100 lignes), alors que **celui qui tourne sur la Box en fait 1938** — la
version de `box-durcissement-2026-08`, jamais fusionnée. Il ne protégeait donc
rien de réel, et l'écraser avec celui de `master` aurait détruit 838 lignes de
durcissement (c'est **BUG-039**).

Val a tranché pour la **réconciliation des branches** (option A). Le correctif a
donc été **reporté sur la version fusionnée**, qui est celle de la Box. Elle
comptait **plus** de points d'écriture que `master` :

| Fichier | Points d'écriture | Dont propres à la version Box |
|---|---|---|
| `.env` | 2 | — |
| `credentials-data.json` | **3** | `/api/set-password` (FEAT-044) |
| `wizard-state.json` | 1 (public, laissé tel quel) | — |

Le troisième point d'écriture des identifiants est le plus facile à manquer : il
ne passe pas par `_write_credentials`. Sans lui, un simple changement de mot de
passe aurait remis le fichier en 644.

**Ce correctif prolonge une convention posée par Val lui-même.** La version de la
Box applique déjà `os.chmod(..., 0o600)` à `.ofelia-secrets.json` et à la clé de
session (FEAT-030) — et de fait, `.ofelia-secrets.json` est bien en **600** sur
la machine. Trois fichiers y avaient échappé ; ils suivent désormais la même
règle.

Vérifié sur Fez contre le `app.py` **réconcilié** : les 15 contrôles passent.
