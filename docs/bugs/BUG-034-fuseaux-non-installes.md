# BUG-034 — L'assistant proposait des fuseaux horaires que la Box refuse

**Statut :** CORRIGÉ et vérifié — 2026-08-22
**Signalé par Val :**
`Error org.freedesktop.DBus.Error.InvalidArgs: Invalid or not installed time zone 'US/Indiana-Starke'`

---

## Cause

`ListTimezones` de systemd annonce **598** fuseaux depuis sa table interne.
Debian n'en installe que **487** sur le disque. Les 113 autres sont des
**alias hérités** — `US/*`, `America/Buenos_Aires`, `Asia/Calcutta`,
`America/Godthab` — qui vivent dans le fichier « backward » de tzdata, non
installé par défaut.

`SetTimezone`, lui, vérifie que le fichier existe. D'où le refus.

Ma liste venait de `ListTimezones` sans filtrage : **113 choix sur 598 étaient
voués à l'échec**. Proposer un choix que le système rejettera est une faute
d'interface, pas un aléa.

## Pourquoi le conteneur ne pouvait pas trancher seul

| | Fuseaux installés |
|---|---|
| Conteneur de l'assistant | 1 259 (tzdata complet, alias inclus) |
| Hôte (la Box) | 487 |

Filtrer avec ses propres fichiers aurait fait accepter au conteneur ce que
l'hôte refuse. Les fichiers de l'hôte sont donc montés en lecture seule :

```yaml
- /usr/share/zoneinfo:/host-zoneinfo:ro
```

Vérifié avant de le faire : les 487 fuseaux de l'hôte sont **tous** connus du
conteneur, le filtrage n'a donc aucun effet de bord sur l'affichage de l'heure.

## Correctif

`_liste_fuseaux()` ne renvoie que les fuseaux dont le fichier existe côté
hôte. Si le montage manque — conteneur non recréé — on ne filtre pas : mieux
vaut une liste trop large qu'une liste vide qui bloquerait tout réglage.

Le message d'erreur nomme désormais le fuseau refusé, au lieu d'un « Fuseau
horaire inconnu » qui n'aidait personne.

## Vérification

| Point | Résultat |
|---|---|
| Fuseaux proposés | 485 (avant : 598) |
| Alias hérités encore proposés | **aucun** |
| Proposés mais non installés | **0** (vérifiés un par un) |
| Échantillon aléatoire de 13 fuseaux appliqués | **13 réussis**, dont `America/Caracas` |
| Fuseau inconnu | refusé, avec son nom dans le message |
