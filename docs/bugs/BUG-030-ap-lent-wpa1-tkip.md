# BUG-030 — Wi-Fi « Ofelia » très lent (802.11g bridé par TKIP)

**Statut :** CORRIGÉ (2026-08-21)
**Composant :** point d'accès `Ofelia-AP` (profil NetworkManager, `wlan0`)

---

## Symptôme

Connecté au Wi-Fi de la Box, `http://ofelia.box/` répond mais toutes les
pages sont anormalement lentes. Le même portail est instantané via le câble
réseau.

## Fausse piste écartée

Première hypothèse : la Box étant hors ligne, des appels sortants (DNS,
API externes) expiraient et bloquaient le rendu des pages.

**Testée et infirmée.** Avec le trafic internet bloqué au pare-feu
(`iptables -I OUTPUT ! -d 192.168.0.0/16 -j DROP`, LAN préservé), les temps
de réponse restent excellents :

| Route | Avec internet | Sans internet |
|---|---|---|
| `/` | 0,0008 s | 0,0007 s |
| `/api/status` | 0,068 s | 0,070 s |
| `/bibliofelia/` | 0,008 s | 0,007 s |

La lenteur ne venait donc pas du logiciel mais du lien radio.

## Cause racine

Trois réglages du point d'accès se cumulaient :

| Réglage | Valeur | Effet |
|---|---|---|
| `802-11-wireless.band` | `bg` | 802.11b/g seul — 54 Mbit/s théoriques, ~20 réels |
| Chiffrement | **WPA1 / TKIP** | La norme 802.11n **interdit** les hauts débits avec TKIP |
| `channel` | `6` | Partagé avec `Lirac` (signal 90), chevauché par `radar` et `visitor` (canal 7) |

Le point le plus coûteux est le TKIP : même en activant explicitement le
mode `n`, la norme impose le repli en débits legacy tant que le chiffrement
est TKIP. Le point d'accès servait donc du 802.11g de 2003 sur le canal le
plus encombré du voisinage.

## Correctif

```bash
nmcli connection modify Ofelia-AP \
  802-11-wireless.channel 11 \
  802-11-wireless-security.proto rsn \
  802-11-wireless-security.pairwise ccmp \
  802-11-wireless-security.group ccmp
```

Le passage en WPA2/CCMP (`rsn`) lève à lui seul le bridage 802.11n. Le
canal 11 était le seul libre lors du scan du voisinage.

## Vérification

Balise réellement diffusée, mesurée depuis `wlan1` :

| | Avant | Après |
|---|---|---|
| Sécurité | WPA1 | **WPA2** |
| Canal | 6 (partagé à 3) | **11 (seul)** |
| Débit annoncé | 54 Mbit/s (bridé) | **65 Mbit/s** (802.11n) |

## Notes

- Le mot de passe du Wi-Fi est inchangé. Un appareil ayant mémorisé le
  réseau en WPA1 peut devoir « oublier le réseau » avant de se reconnecter.
- L'assistant d'installation (`_do_apply_ap_config`) ne modifie que le SSID
  et le mot de passe : ces réglages survivent à un changement depuis l'UI.
- **URL sur le Wi-Fi Ofelia** : `http://192.168.50.1/` (portail) et
  `http://192.168.50.1:8080/` (administration). Le profil est en
  `ipv4.method: shared` avec `192.168.50.1/24`.
- La bande reste `bg` (2,4 GHz) : volontaire, la portée prime sur le débit
  pour un usage de bibliothèque, et le Wi-Fi intégré de la Pi 5 est
  monobande sur ce profil.

## Lacune de sauvegarde découverte à cette occasion

Le profil `Ofelia-AP` n'est créé **par aucun script** — ni `bootstrap.sh`,
ni l'assistant, qui se contente d'en modifier le SSID et le mot de passe.
Il n'existait que dans `/etc/NetworkManager/system-connections/` sur cette
Box. Une réinstallation aurait produit une Box **sans aucun Wi-Fi**.

`scripts/backup-usb.sh` archive désormais les profils NetworkManager, et
`RESTAURER-OFELIA.sh` les restaure puis réactive le point d'accès.
