# FEAT-033 — Démarrage ordonné, visible, et réglage de l'heure

**Statut :** IMPLÉMENTÉ — en attente du test de Val
**Demande :** « la non réponse sans aucun message est un problème : avant de lancer
les containers on va afficher une page sur les 2 urls (assistant et portail) qui
propose de mettre à jour l'heure et qui affiche une barre de progression qui permet
de voir quelle application est en train de démarrer. les containers seront démarrés
1 par 1 pour éviter de saturer. »

---

## Le problème

Au démarrage, Docker relançait les **14 conteneurs simultanément**. Trois
conséquences, toutes constatées sur la Box :

1. La carte SD saturait — jusqu'à 90 % du temps passé à attendre les
   entrées/sorties. Le démarrage complet prenait 10 à 15 minutes.
2. Pendant tout ce temps, l'usager n'avait **aucun signe de vie** : le portail
   répondait mais chaque application renvoyait « 502 Bad Gateway ».
3. Sur un site distant, on en conclut que la Box est en panne — c'est
   exactement ce qui s'est produit le 2026-08-22 au matin.

## Ce qui a été fait

### 1. nginx démarre seul, et en premier

C'était le verrou. Les applications étaient déclarées en **upstreams statiques** :

```nginx
upstream moodle  { server edubox-moodle:8080; }
```

nginx résout ces noms **au chargement de sa configuration** et refuse de démarrer
si un conteneur n'existe pas encore. Il ne pouvait donc pas précéder les
applications — il redémarrait en boucle jusqu'à ce que toutes soient là.

Tout est passé en **résolution dynamique** par le DNS interne de Docker :

```nginx
resolver 127.0.0.11 valid=10s ipv6=off;   # une fois, en contexte http
...
location /moodle/ {
    set $moodle http://edubox-moodle:8080;
    rewrite ^/moodle/(.*)$ /$1 break;
    proxy_pass $moodle;
}
```

> ⚠️ **Le piège** : avec `proxy_pass $variable`, nginx transmet l'URI d'origine
> **telle quelle**. La forme statique `proxy_pass http://moodle/` retirait le
> préfixe de la location — comportement qu'il faut reproduire explicitement avec
> `rewrite … break`. Chaque location converties porte un commentaire indiquant ce
> qu'elle reproduit. Converties : Moodle, Kolibri, Kiwix, Calibre, tableau de bord,
> et les deux hôtes virtuels.

**Vérifié** : avec Moodle, Kiwix et Calibre arrêtés, nginx démarre
(`RestartCount=0`), sert le portail en 200, et affiche la page d'attente au lieu
d'un 502 brut.

### 2. Les conteneurs ne démarrent plus tous seuls

Docker relance au démarrage du démon **tous** les conteneurs marqués `always` ou
`unless-stopped`. Les applications passent donc en **`on-failure:10`** :

- Docker ne les lance plus à l'allumage — c'est l'orchestrateur qui décide ;
- un conteneur qui **plante en cours de route** est toujours relancé, jusqu'à dix
  fois. La résistance aux incidents est conservée.

Le portail (`nginx`) et l'assistant (`setup`) **gardent `unless-stopped`** : ce
sont eux qui affichent la page de démarrage. Ils doivent être là avant tout le
reste, et sans dépendre du bon fonctionnement de l'orchestrateur — si la séquence
échoue, l'usager voit au moins une page qui le lui dit.

Les `depends_on` de nginx sont retirés : ils n'existaient que pour compenser les
upstreams statiques.

### 3. L'orchestrateur

`scripts/ofelia-boot.sh`, lancé par `ofelia-boot.service` après `docker.service`.

| # | Étape | Conteneurs |
|---|---|---|
| 1 | Portail et assistant | `healthcheck` (nginx et setup sont déjà là) |
| 2 | BibliOfelia | `bibliofelia`, `bibliofelia-worker` |
| 3 | Moodle | `mariadb`, `memcached`, `moodle` |
| 4 | Kolibri | `kolibri` |
| 5 | Bibliothèques hors-ligne | `kiwix` — Wikipedia, Wikisource, Gutenberg |
| 6 | Calibre | `calibre` |
| 7 | Digistorm | `redis`, `digistorm` |
| 8 | Outils techniques | `portainer` |

Les dépendances techniques voyagent avec l'application qu'elles servent :
MariaDB avec Moodle, Redis avec Digistorm. Chacune est démarrée **avant** son
application, dans la même étape.

**Une étape n'est déclarée prête que lorsque l'application RÉPOND** (code HTTP
< 500), pas quand le conteneur est « Up ». C'est toute la différence : un
conteneur démarré dont l'application charge encore renvoie 502, et c'est
précisément ce qu'il ne faut pas annoncer comme terminé.

Chaque étape a un plafond de 420 secondes. Dépassé, elle est marquée « ne répond
pas » et **la séquence continue** : une application en panne ne doit jamais
empêcher les autres de démarrer.

> **Ajouter une application plus tard** : une ligne à la fin du tableau `ETAPES`,
> et son libellé dans les traductions de `portal/boot.html`. Rien d'autre.

### 4. La page de progression

`portal/boot.html`, servie à l'identique sur les **trois** adresses :

| Adresse | Mécanisme |
|---|---|
| `http://<box>/` et `https://<box>/` | `try_files /boot-active.html /index.html` |
| `http://<box>:8080/` | redirection vers `/demarrage` tant que la séquence tourne |

L'orchestrateur crée `boot-active.html` au début et le supprime à la fin. La
bascule se fait donc **sans rechargement de configuration nginx** : le portail
reprend sa place tout seul.

La page relit `boot-status.json` toutes les 2 secondes et affiche une barre de
progression, la liste des étapes, celle en cours, et le temps passé. Elle bascule
vers le portail dès que la séquence est terminée.

Traduite dans les **six langues du portail** (fr, en, es, pt, it, de), et elle
reprend la langue déjà choisie par l'usager (`localStorage: ofelia-lang`).

**Aucune ressource externe** : la Box est faite pour fonctionner sans internet,
une police chargée depuis un CDN laisserait la page nue sur le terrain.

### 5. Le réglage de l'heure

Le Pi 5 **n'a pas de pile d'horloge**. Hors tension il ne compte plus, et repart
de la dernière heure enregistrée. Constaté le 2026-08-22 : le journal de
démarrage commençait à 00:19 alors qu'il était 12:12.

Avec internet, NTP corrige tout seul. **Sans internet — le cas de Canaima — rien
ne corrige**, et une heure fausse donne des **dates de prêt fausses dans
BibliOfelia**.

La page propose donc un réglage manuel, **uniquement quand NTP n'est pas
synchronisé**, comme demandé par Val. Le champ est pré-rempli avec l'heure du
navigateur — celle du téléphone du bibliothécaire, presque toujours juste.

Trois précautions :

- Le navigateur envoie un **instant absolu** (millisecondes depuis 1970), pas une
  date écrite : le fuseau du téléphone et celui de la Box n'ont pas besoin de
  coïncider pour que l'instant soit juste.
- L'API **refuse** dès que NTP est synchronisé (`409`). Avec internet, NTP fait
  autorité — accepter une saisie manuelle laisserait n'importe qui fausser les
  dates de prêt.
- Une date hors de [2025, 2100] est rejetée : une faute de frappe ne doit pas
  envoyer la Box en 1970 et périmer tous les prêts d'un coup.

Techniquement : `SetNTP(false)` → `SetTime` → `SetNTP(true)` via D-Bus
(`org.freedesktop.timedate1`). systemd refuse `SetTime` tant que la
synchronisation automatique est active ; on la réactive ensuite pour que NTP
reprenne la main dès que la Box retrouve internet.

### 6. Accès sans mot de passe — et ses limites

`/demarrage`, `/api/boot-status` et `/api/set-time` sont accessibles **sans le mot
de passe d'administration**. C'est délibéré : au démarrage sur un site distant, la
personne devant la Box est un bibliothécaire, pas un administrateur. Lui refuser
l'information rendrait la page inutile là où elle sert le plus.

**Vérifié** : le reste de l'assistant demeure protégé — `/` et `/credentials`
redirigent vers la page de connexion, `/api/backup/status` renvoie 401.

---

## Fichiers

| Fichier | Nature |
|---|---|
| `scripts/ofelia-boot.sh` | nouveau — l'orchestrateur |
| `/etc/systemd/system/ofelia-boot.service` | nouveau — lancement au démarrage |
| `portal/boot.html` | nouveau — page de progression, 6 langues |
| `nginx/conf.d/edubox.conf` | résolution dynamique, `resolver` global |
| `nginx/conf.d/ofelia-locations.inc` | 7 locations converties, `try_files` de bascule |
| `setup/app.py` | `/demarrage`, `/api/boot-status`, `/api/set-time` |
| `docker-compose.yml` | `on-failure:10`, `depends_on` nginx retirés |

## Vérifications effectuées

| Point | Résultat |
|---|---|
| Syntaxe nginx | OK |
| Les 15 routes après conversion | identiques à avant |
| nginx démarre sans Moodle/Kiwix/Calibre | OK, `RestartCount=0` |
| Séquence complète, applications déjà lancées | 8/8 en 27 s |
| Bascule de page sur `:80`, `:443`, `:8080` | OK dans les deux sens |
| Assistant : routes publiques | 200 |
| Assistant : reste protégé | 302 / 401 |
| Réglage de l'heure avec NTP actif | refusé (409), message explicite |
| Syntaxe JavaScript de la page | OK |

## Deux bogues corrigés pendant l'écriture

**Portée des variables en bash.** `publier()` utilisait `i` comme compteur, la
même variable que la boucle principale — bash n'a pas de portée locale implicite.
Le compteur était écrasé à chaque publication et la séquence s'arrêtait au premier
tour (« étape 9/8 »). Corrigé par `local k`. Même correction sur `t0`, partagé
entre `attendre_reponse()` et la boucle principale.

**Fins de ligne Windows.** Le script réécrit depuis un poste Windows est parti
avec des `\r\n` ; le noyau ne trouvait plus l'interpréteur
(`required file not found` sur le shebang). Normalisé à l'installation.

## Reste ouvert

- **Le fuseau horaire** n'est pas traité : la Box est en `Europe/Paris`. À
  Canaima il faudrait `America/Caracas`, sans quoi l'instant sera juste mais
  l'heure affichée décalée. À décider avec Val.
- Le temps de démarrage lui-même n'est pas encore mesuré dans les conditions
  réelles (démarrage à froid) — voir le journal `data/boot.log`.

---

## Mesures réelles (démarrage à froid du 2026-08-22)

| Étape | Durée |
|---|---|
| Portail *(= démarrage de `docker.service`)* | 353 s |
| BibliOfelia | 458 s |
| Moodle | 82 s |
| Calibre | 84 s |
| Kolibri, bibliothèques, Digistorm, outils | 15 s au total |
| **Total** | **17 min 43** |

⚠️ **Ces durées sont fausses.** Elles ont été mesurées avec l'heure murale,
que NTP déplace précisément pendant les premières étapes (le Pi 5 n'a pas de
pile d'horloge et démarre à une heure fausse). Les « 458 s » de BibliOfelia
n'en étaient pas : le plafond a été franchi par une correction d'horloge, pas
par une application lente — voir BUG-035.

Corrigé : toutes les mesures passent par `/proc/uptime`, que rien ne déplace.

```bash
mono() { awk '{printf "%d", $1}' /proc/uptime; }
```

> Piège rencontré : `mono()` était définie **après** son premier appel
> (`DEBUT=$(mono)`). En bash, l'appel échoue alors sans bruit, `DEBUT` vaut
> la chaîne vide, traitée comme 0 — la séquence annonçait « terminé en
> 31619 s », soit l'uptime de la machine. Une fonction doit être définie
> avant sa première utilisation.

Séquence rejouée après correction : **8/8 étapes en 26 s** (applications déjà
lancées), durée cohérente avec la somme des étapes.

## Un échec ne doit pas rester figé

Une étape marquée « ne répond pas » le restait indéfiniment : le fichier
d'état décrit l'instant du démarrage, pas la Box qui tourne depuis. Val a vu
BibliOfelia affiché en erreur des heures après qu'il fonctionnait — voir
BUG-036.

Deux garde-fous ajoutés :

1. **Une passe de vérification finale** en fin de séquence : les étapes en
   échec sont retestées, elles ont bénéficié du temps qu'ont pris les
   suivantes.
2. **`/api/boot-status` revérifie à la lecture** les étapes en échec, et
   corrige le fichier. Seulement celles-là : une étape prête n'est jamais
   resollicitée.

L'orchestrateur publie l'URL de vérification de chaque étape dans le fichier
d'état, pour que l'assistant sache quoi retester sans dupliquer la liste.

## L'unité systemd

`Type=simple` et non `oneshot` : en `oneshot`, `multi-user.target` restait
« en cours » pendant toute la séquence, soit 18 minutes de démarrage annoncé
par `systemd-analyze` pour une Box déjà utilisable.

L'unité est versionnée dans `systemd/` et réinstallée par
`scripts/RESTAURER-OFELIA.sh` : sans ça, une Box réinstallée repartirait avec
les 14 conteneurs lancés d'un coup, sans que personne ne s'en aperçoive avant
le premier redémarrage sur site.
