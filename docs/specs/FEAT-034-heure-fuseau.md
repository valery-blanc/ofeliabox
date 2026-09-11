# FEAT-034 — Date, heure et fuseau horaire réglables

**Statut :** FAIT, validé par Val — 2026-08-22
**Demande :** « rajouter la date, l'heure et le fuseau horaire utilisé, même
quand on a internet, et si possible un moyen de changer le fuseau horaire ou
régler la date et l'heure manuellement même s'il y a internet », puis
« rajouter le réglage fuseau, heure, date dans l'assistant aussi ».

---

## Pourquoi c'est nécessaire

**Le Raspberry Pi 5 n'a pas de pile d'horloge.** Hors tension il ne compte
plus et repart de la dernière heure enregistrée. Constaté le 2026-08-22 : le
journal de démarrage commençait à 00:19 alors qu'il était 12:12.

Avec internet, NTP corrige seul. **Sans internet — le cas de Canaima — rien
ne corrige**, et une heure fausse produit des **dates de prêt fausses dans
BibliOfelia**.

Le fuseau, lui, n'a rien à voir avec NTP. Une Box parfaitement à l'heure mais
restée en `Europe/Zurich` affiche à Canaima des dates décalées de six heures.
C'est pourquoi le panneau est visible **en permanence**, avec ou sans
internet.

## Où

| Endroit | Accès |
|---|---|
| Page de démarrage (`/`, puis `:8080/boot`) | **sans mot de passe** |
| Assistant d'administration (`:8080/`) | derrière le mot de passe |

L'accès libre sur la page de démarrage est délibéré : au démarrage sur un
site distant, la personne devant la Box est un bibliothécaire, pas un
administrateur.

## API

| Route | Rôle |
|---|---|
| `GET /api/time-info` | date, heure, fuseau, décalage UTC, état NTP ; `?zones=1` ajoute la liste |
| `POST /api/set-timezone` | change le fuseau |
| `POST /api/set-time` | règle l'horloge |
| `POST /api/set-ntp` | active ou coupe la synchronisation |

Tout passe par D-Bus (`org.freedesktop.timedate1`) ; l'assistant a `/run/dbus`
monté depuis l'hôte.

## Trois décisions

**L'heure envoyée est un instant absolu** (millisecondes depuis 1970), jamais
une date écrite : le fuseau du téléphone du bibliothécaire et celui de la Box
n'ont pas besoin de coïncider pour que l'instant soit juste.

**Régler l'heure coupe NTP, et on ne le rallume pas en douce.** Sinon la
synchronisation effacerait le réglage dans la minute. Un bouton de
réactivation apparaît — **uniquement quand la synchronisation est réellement
éteinte** : une Box sans internet a NTP allumé mais infructueux, lui proposer
de « réactiver » n'aurait aucun sens.

**Les dates absurdes sont refusées** (hors 2025-2100) : une faute de frappe ne
doit pas envoyer la Box en 1970 et périmer tous les prêts d'un coup.

## Deux bogues corrigés pendant l'écriture

**L'assistant affichait l'heure UTC**, pas celle de la Box : 11:45 au lieu de
13:45. Le conteneur tourne en UTC et ignore le fuseau de l'hôte. Appeler
`date` en sous-processus n'y changeait rien — ce `date` s'exécute lui aussi
dans le conteneur. L'heure est désormais calculée avec `zoneinfo.ZoneInfo`
depuis le fuseau que systemd déclare, et suit donc tout changement sans
redémarrage.

**Le réglage manuel posait une heure périmée** — voir BUG-035, la conséquence
a été une horloge reculée d'exactement 24 heures.

## Vérifications

| Point | Résultat |
|---|---|
| Heure affichée = heure de la Box | oui, décalage inclus (`+0200`) |
| Changement de fuseau, échantillon aléatoire | **13/13**, dont `America/Caracas` |
| Fuseau inconnu | refusé, message nommant le fuseau |
| Réglage manuel avec internet | fonctionne, NTP coupé et signalé |
| Date hors bornes | refusée |
| Réactivation de la synchronisation | fonctionne, bouton conditionnel |
| Traductions | 6 langues sur la page de démarrage |

## Reste ouvert

Le fuseau de la Box était `America/Caracas` au moment de la clôture. À
confirmer avant le départ : c'est le bon pour le terrain, mais tant que la Box
est en Europe les horodatages s'affichent avec six heures de décalage.
