# FEAT-037 — La page de démarrage passe de `/demarrage` à `/boot`

**Statut :** IMPLÉMENTÉ — en attente du test de Val
**Demande :** « est-ce qu'on pourrait avoir la page de démarrage sur l'url /boot
au lieu de /demarrage »

---

## Le changement

| Adresse | Avant | Après |
|---|---|---|
| `http://<box>:8080/boot` | 404 | **la page de progression** |
| `http://<box>:8080/demarrage` | la page | redirection 302 vers `/boot` |
| `http://<box>:8080/` pendant la séquence | redirige vers `/demarrage` | redirige vers `/boot` |

`/boot` est plus court, se tape sans accent et sans se demander comment
l'orthographier — ce qui compte sur un site distant où l'adresse est dictée au
téléphone. Elle reste accessible **sans mot de passe**, comme `/demarrage`
l'était : c'est la raison d'être de la page (voir FEAT-033 § 6).

## Pourquoi l'ancienne adresse survit

`/demarrage` est écrite dans FEAT-033, FEAT-034, BUG-036, et probablement dans
des marque-pages. La casser produirait exactement le symptôme que cette page
existe pour dissiper : une Box qui « ne répond pas ».

La redirection est **temporaire (302), jamais permanente (301)**. Un 301 se met
en cache dans le navigateur sans date de péremption : redonner un jour un autre
sens à `/demarrage` obligerait alors à vider le cache de chaque appareil qui
l'a visitée. Le coût d'un 302 est un aller-retour HTTP sur une page consultée
quelques fois par an.

## Fichiers

| Fichier | Nature |
|---|---|
| `setup/app.py` | route `/boot`, redirection `/demarrage`, liste des routes libres |

L'endpoint Flask a changé de nom (`demarrage` → `boot`), donc les deux endroits
qui le désignent par son nom ont suivi : la liste des routes consultables sans
mot de passe dans `_require_admin_login`, et le `url_for()` qui redirige la
racine pendant la séquence. Un oubli s'y serait vu tout de suite — la page
aurait demandé un mot de passe.

## Vérifications effectuées

Sur la Box, après redémarrage du conteneur `edubox-setup` :

| Appel | Résultat |
|---|---|
| `GET :8080/boot` | **200**, 29 682 octets, sans authentification |
| `GET :8080/demarrage` | **302** vers `http://<box>:8080/boot` |
| `GET :8080/demarrage` en suivant la redirection | **200**, même page |
| `GET :8080/` (séquence terminée) | 302 vers `/login?next=/` — inchangé |

Le fait que `/boot` réponde 200 *directement*, sans passer par `/login`,
démontre que la liste des routes libres a bien été mise à jour : une erreur de
nom d'endpoint aurait produit une redirection vers la connexion.
