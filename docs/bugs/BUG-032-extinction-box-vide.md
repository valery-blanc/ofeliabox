# BUG-032 — Après extinction par le bouton, la Box redémarrait vide

**Statut :** CORRIGÉ et vérifié par redémarrage (2026-08-21)
**Origine :** régression introduite par FEAT-030 (le bouton d'extinction lui-même)

---

## Symptôme

Val éteint la Box avec le bouton du portail d'administration. L'extinction
fonctionne (LED rouge). Après rebranchement de l'alimentation, **seul le
portail d'administration répond** ; le portail principal et toutes les
applications sont absents.

## Cause racine

Mon implémentation de `POST /api/shutdown` arrêtait explicitement les
conteneurs avant d'éteindre :

```python
subprocess.run(["docker", "stop", "-t", "20", *others], ...)
```

Or tous les services sont en **`restart: unless-stopped`**. Cette politique
signifie littéralement « relance le conteneur, *sauf s'il a été arrêté
délibérément* ». Un `docker stop` explicite est exactement cet arrêt
délibéré : Docker mémorise que l'opérateur ne veut plus de ce conteneur et
ne le relance **pas** au démarrage suivant.

`edubox-setup` revenait parce que je l'avais exclu de la liste — pour éviter
que le portail se tue lui-même avant d'avoir lancé l'extinction. C'est cette
exclusion qui a rendu le symptôme si lisible : le seul conteneur épargné par
le `docker stop` était le seul à repartir.

Autrement dit : le bouton censé protéger la Box d'un arrêt brutal la rendait
inutilisable au redémarrage. Plus grave qu'une coupure de courant, qui elle
laisse les conteneurs repartir.

## Correctif

Ne rien arrêter à la main. `systemd` arrête `docker.service` pendant sa
séquence d'extinction, ce qui envoie `SIGTERM` aux conteneurs avec un délai
de grâce. Des conteneurs arrêtés par l'arrêt du démon conservent leur état
« voulu = démarré » et repartent normalement.

```python
def _worker():
    time.sleep(1)   # laisser la réponse HTTP partir
    subprocess.run([
        "dbus-send", "--system", "--print-reply",
        "--dest=org.freedesktop.login1", "/org/freedesktop/login1",
        "org.freedesktop.login1.Manager.PowerOff", "boolean:true",
    ], capture_output=True, timeout=30)
```

L'arrêt est donc *plus* propre qu'avant, et non moins : c'est Docker qui
gère la fin de vie de ses conteneurs, pas un script extérieur.

## Vérification

Redémarrage complet après correction :

| | Résultat |
|---|---|
| Conteneurs revenus seuls | **14 / 14** |
| Services répondant | 6 / 6 |
| Redémarrages de nginx | **0** |

Le chemin exercé est identique à celui de l'extinction (systemd arrête
`docker.service`), au seul appel `PowerOff` final près.

---

# Régression jointe — nginx plantait en boucle au démarrage

## Cause

FEAT-030 avait retiré les `depends_on` de `nginx-proxy` pour qu'il démarre
en premier et puisse afficher la page d'attente. Mais ses upstreams sont
**statiques** :

```nginx
upstream moodle  { server edubox-moodle:8080; }
upstream kolibri { server edubox-kolibri:8080; }
upstream kiwix   { server edubox-kiwix:8080; }
```

nginx résout ces noms **au démarrage** et refuse de démarrer si un
conteneur n'existe pas encore (`host not found in upstream`). Il
redémarrait donc en boucle jusqu'à ce que tous soient créés.

## Correctif

`depends_on` rétablis sur `moodle`, `kolibri`, `kiwix` — les trois
upstreams statiques restants après le retrait de Koha. Ces dépendances
n'attendent que la *création* des conteneurs, pas leur bonne santé : c'est
rapide, et la page d'attente couvre le temps où l'application démarre
encore.

Vérifié : **0 redémarrage** de nginx sur le boot suivant.

> La solution de fond serait de passer les upstreams en résolution
> dynamique (`resolver 127.0.0.11` + variable), ce qui rendrait nginx
> totalement indépendant. Écarté sciemment : avec une variable, nginx ne
> réécrit plus l'URI de la même façon et le routage de chaque application
> change. Trop risqué la veille d'un déploiement.

---

## Temps de démarrage — mesure honnête

| Mesure | Résultat |
|---|---|
| Avant tout changement | ~15 min |
| Après retrait Koha/PMB/SLiMS (13h52) | 5 min 03 |
| Après rétablissement des depends_on (18h04) | 9 min 15 |

L'écart entre les deux dernières mesures ne vient pas des `depends_on` :
au démarrage, Docker relance les conteneurs sans honorer `depends_on` (il
n'agit qu'au `docker compose up`). Le boot est **saturé en E/S**, et sa
durée varie selon ce qui tourne en parallèle. `systemd-analyze` :

```
docker.service            3min 03s   (14 conteneurs simultanés)
rpi-eeprom-update.service 2min 52s   ← désactivé
NetworkManager.service    2min 21s
cloud-final.service       1min 07s
```

`rpi-eeprom-update` a été **désactivé** : il ne fait que vérifier la
version du micrologiciel, inutile à chaque démarrage sur un site distant.
Vérification manuelle toujours possible : `sudo rpi-eeprom-update`.

`cloud-final` (1 min 07) est un candidat au retrait mais n'a pas été
touché : c'est de l'initialisation Raspberry Pi OS, et le risque n'a pas
été évalué avant le départ.

BibliOfelia rejoue par ailleurs migrations + compilation des traductions +
collecte des fichiers statiques **à chaque démarrage** (~4 min sur carte
SD). Optimisable, non traité ici.
