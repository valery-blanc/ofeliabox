# BUG-033 — Moodle perd ses styles derrière le proxy HTTPS

**Statut :** CORRIGÉ et vérifié sur l'URL publique — 2026-08-21
**Symptôme :** `https://canaima.bibliofelia.org/moodle/login/index.php` s'affiche sans aucune mise en forme.

---

## Le montage réseau, qui explique tout

`canaima.bibliofelia.org` ne désigne pas la Box. Il désigne l'IP publique du
domicile (`31.164.198.65`), d'où **Traefik** (sur Fez) prend le relais :

```
navigateur ──https──> Traefik (Fez) ──http──> nginx Box :80 ──> Moodle
            TLS ici                  EN CLAIR
```

Traefik termine le TLS et transmet la requête **en clair** à la Box. Du point
de vue de la Box, la requête est donc en HTTP — alors que le navigateur, lui,
est bien en HTTPS.

## Cause racine

Deux fautes qui s'additionnent.

**1. nginx écrasait l'information.** Traefik signale le protocole d'origine
dans l'en-tête `X-Forwarded-Proto: https`. Mais `proxy_params` contenait :

```nginx
proxy_set_header X-Forwarded-Proto $scheme;   # $scheme = "http" ici
```

`$scheme` est le protocole de la connexion *entrante côté Box*, soit `http`.
L'en-tête de Traefik était donc remplacé par `http` avant d'arriver à Moodle.

**2. Moodle était figé en HTTP.** Le script `99-fix-wwwroot.sh` construisait :

```php
$CFG->wwwroot = 'http://' . $_SERVER['HTTP_HOST'] . '/moodle';
$CFG->sslproxy = false;
```

Le protocole était écrit en dur. Moodle fabriquait donc `http://canaima…/moodle/…`
pour chacune de ses feuilles de style à l'intérieur d'une page servie en HTTPS.
**Le navigateur bloque ces requêtes — c'est la règle du contenu mixte.** Le HTML
arrivait bien, les styles non : d'où la page brute.

## Correctif

**nginx** — nouveau fichier `nginx/conf.d/00-forwarded-proto.conf` :

```nginx
map $http_x_forwarded_proto $forwarded_proto {
    default    $scheme;
    "~*^https" https;
    "~*^http$" http;
}
```

et dans `proxy_params` : `proxy_set_header X-Forwarded-Proto $forwarded_proto;`

L'en-tête d'origine est conservé quand il existe, et on retombe sur `$scheme`
lors d'un accès direct à la Box (réseau local, point d'accès Wi-Fi) où aucun
proxy amont n'est présent. **Les deux modes d'accès continuent de fonctionner.**

**Moodle** — `wwwroot` et `sslproxy` deviennent dynamiques, dérivés de
`X-Forwarded-Proto` (l'en-tête pouvant contenir une liste `"https, http"`, seul
le premier élément fait foi).

Puis purge des caches : `php admin/cli/purge_caches.php` — Moodle mémorise des
URL absolues, changer `wwwroot` sans purger laisserait les anciennes.

## Vérification

Sur l'URL publique réelle, `https://canaima.bibliofelia.org/moodle/login/index.php` :

| | Résultat |
|---|---|
| URL `http://` restantes (contenu mixte) | **0** |
| URL `https://` | 30 |
| Feuille de style du thème | **200, 1 064 289 octets** |

Et l'accès local reste intact : `http://ofelia.box/moodle/` produit bien des
URL `http://ofelia.box/…`.

## Portée

Le correctif nginx est **générique** : toute application derrière ce proxy
bénéficie désormais du bon protocole. Moodle était la plus visible parce que
son thème est entièrement en CSS externe.
