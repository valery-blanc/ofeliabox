# BUG-029 — Le bouton « Rechercher les réseaux » n'effectuait aucun scan

**Statut :** CORRIGÉ (validé par Val le 2026-08-21 — hotspot apparu après correction)
**Composant :** portail d'administration (`setup/app.py`, route `/api/wifi/scan`)

---

## Symptôme

Val allume le partage de connexion de son téléphone, clique sur
« Rechercher les réseaux » dans le portail d'administration : le hotspot
n'apparaît pas. La liste semble par ailleurs anormalement courte (7 réseaux)
alors que le voisinage en compte davantage.

## Reproduction

1. Allumer un point d'accès Wi-Fi à proximité de la Box
2. Portail d'admin → section réseau → « Rechercher les réseaux »
3. Le réseau nouvellement allumé est absent, parfois durablement

## Cause racine

Deux défauts distincts et cumulatifs.

### 1. Aucun balayage n'était déclenché

```python
result = subprocess.run(
    ["nmcli", "--terse", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list",
     "ifname", iface], ...)
```

`nmcli dev wifi list` renvoie le **cache** de NetworkManager, pas un
balayage neuf. NetworkManager rafraîchit de lui-même, mais à un rythme de
l'ordre de la minute et souvent moins souvent lorsque l'interface est déjà
associée à un réseau. Un point d'accès allumé quelques instants plus tôt
n'avait donc aucune chance d'y figurer.

C'est le cas d'usage principal sur le terrain — connecter la Box au partage
de connexion d'un téléphone — qui était cassé.

### 2. L'analyse de la sortie décalait certaines colonnes

`nmcli --terse` échappe les deux-points contenus dans les valeurs :
un réseau nommé `Free:Wifi` sort en `Free\:Wifi`. Or le code découpait sur
**tous** les deux-points :

```python
parts = line.split(":")
ssid, signal_str, security = parts[0], parts[1], ":".join(parts[2:])
```

Pour ces réseaux, `parts[1]` recevait la fin du SSID au lieu du signal :
`int(signal_str)` échouait, le signal tombait à 0 et le nom affiché était
tronqué.

## Correctif

- Appel de `nmcli device wifi rescan ifname <iface>` avant de lister, suivi
  d'une attente de 7 s (parcours des canaux 2,4 et 5 GHz). Un échec du
  rescan est ignoré : NetworkManager refuse deux balayages rapprochés, on
  liste alors le cache existant plutôt que de renvoyer une erreur.
- Découpage sur les seuls séparateurs réels via
  `re.split(r"(?<!\\):", line)`, puis déséchappement des valeurs.

## Vérification

| | Avant | Après |
|---|---|---|
| Réseaux listés par le portail | 7 | **9** |
| Hotspot fraîchement allumé | absent | **détecté** |
| Temps de réponse du bouton | immédiat (cache) | ~8 s (balayage réel) |

Les réseaux à SSID masqué (2 dans le voisinage) restent volontairement
exclus : sans nom, ils ne sont pas sélectionnables dans la liste.

## Notes

- L'interface cliente est `wlan1` (clé USB ASUS 802.11ax). `wlan0` porte le
  point d'accès `Ofelia-AP` et n'est jamais utilisée pour le scan.
- Le SSID `Ofelia` (le point d'accès de la Box elle-même) apparaît dans la
  liste des réseaux joignables. Sans conséquence, mais inutile — pourrait
  être filtré.
- Causes fréquentes d'un hotspot réellement invisible, hors bug : le
  téléphone cesse d'émettre faute de client (≈90 s sur iPhone si l'écran
  « Partage de connexion » est fermé), ou émet en 5 GHz/WPA3 mal géré par
  l'adaptateur.
