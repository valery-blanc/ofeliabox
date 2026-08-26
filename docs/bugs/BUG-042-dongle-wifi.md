# BUG-042 — Le dongle Wi-Fi se déconnecte toutes les 15 secondes

**Statut :** NON RÉSOLU — pilote `rtw89_8852bu` défaillant, deux noyaux essayés
**Constaté :** 2026-08-26, en rétablissant l'architecture réseau prévue.

---

## L'architecture voulue

| Interface | Rôle |
|---|---|
| `wlan0` (Wi-Fi interne) | point d'accès « Ofelia » — l'accès des bibliothécaires à Canaima |
| `wlan1` (dongle USB) | Wi-Fi de maintenance — la voie de Val vers internet |
| `eth0` | câble, quand il y en a un |

## Le symptôme

`wlan1` ne se connecte jamais. Il alterne indéfiniment entre `connecting` et
`disconnected`, avec dans le journal du noyau :

```
rtw89_8852bu 3-1:1.0: usb read32 0x18104 fail ret=-110 value=0x0
usb 3-1: USB disconnect, device number 13
usb 3-1: new high-speed USB device number 14
```

`ret=-110` est un dépassement de délai sur le bus USB. Le cycle dure **environ
15 secondes** : énumération, chargement du firmware, échec de lecture,
déconnexion, et l'on recommence. **121 ré-énumérations** relevées en une heure.

## Ce qui est écarté, mesures à l'appui

| Hypothèse | Réfutation |
|---|---|
| Port USB défectueux | Le défaut se reproduit **à l'identique sur les deux ports bleus** |
| Mauvais contact SuperSpeed | ❌ **Mon erreur** : l'adaptateur déclare `bcdUSB 2.00`, il *est* USB 2.0 par conception. Les 480 Mb/s sont normaux |
| Rallonge ou hub | Aucun — branchement direct sur la Pi |
| Alimentation insuffisante | **4280 mA** disponibles, `usb_over_current_detected: 0`, `throttled=0x0` |
| Mise en veille USB | `power/control` était déjà à `on`. ⚠️ Et ce réglage est **perdu à chaque ré-énumération** — une règle udev a été posée |
| Gestion d'énergie du pilote | `disable_ps_mode=Y` appliqué (contournement documenté) : **sans effet** |
| Dongle mort | Non : sa **radio fonctionne**, il scanne parfaitement (`radar` 100 %, `Lirac` 92 %) |

## Ce que le faisceau désigne

Le dongle **énumère, charge son firmware et scanne** — mais échoue dès que la
communication USB doit être soutenue. Le scan procède par courtes rafales,
l'association demande un flux continu.

Reste donc : un **défaut du pilote `rtw89_8852bu`** avec le noyau
`6.18.34+rpt-rpi-2712`, ou un **défaut matériel intermittent** du dongle.

⚠️ **Test décisif, non fait : brancher le dongle sur une autre machine.**
S'il fonctionne ailleurs, c'est le pilote sur la Pi ; s'il échoue aussi, il est
à retourner malgré son jeune âge.

## ❌ Le port USB 2.0 n'était pas la solution

**J'ai conclu trop vite.** Après le passage sur un port noir, j'avais relevé
0 déconnexion et annoncé « parfaitement stable » — sur **deux minutes
d'observation**. Le compteur réel sur la même session : **19 déconnexions**.

Le port noir améliore nettement les choses sans les régler. Ce n'est donc pas
un critère de choix mais un détail secondaire.

## ❌ Le changement de noyau non plus

Val a posé la bonne question : *« pourquoi n'avait-on pas ce problème avec
l'ancienne carte SD hier ? »* La comparaison est sans appel :

| | Ancienne carte | Nouvelle carte |
|---|---|---|
| Noyau | **6.12.75** | **6.18.34** |
| Dongle | fonctionnait (`192.168.0.204`) | boucle sans jamais s'associer |

Le dongle marchait la veille. Ce n'est ni le matériel, ni le port, ni
l'alimentation : **le pilote `rtw89_8852bu` a régressé entre 6.12 et 6.18.**

Retour en 6.12 : **impossible**, le dépôt Raspberry Pi ne propose plus que la
6.18. Essai de la version la plus récente disponible :

```
apt install linux-image-rpi-2712    →  6.18.39
```

| Noyau | Déconnexions | Association |
|---|---|---|
| 6.18.34 | 3,8 / min | jamais |
| **6.18.39** | **3,2 / min** | **jamais** |

**Aucune amélioration.** 106 déconnexions en 33 minutes, l'interface reste
bloquée sur `connecting (configuring)`.

⚠️ L'ancien noyau **6.18.34 reste installé** : on peut y revenir, mais rien
n'indique que ce serait mieux.

## 🔀 Une alternative qui évite d'acheter du matériel

Val : *« c'est difficile de trouver un dongle en étant sûr qu'il a le bon
chipset : ce n'est pas indiqué sur digitec. »* C'est vrai — les revendeurs
n'annoncent pas la puce, et un même modèle peut en changer d'une révision à
l'autre.

Or le Wi-Fi **interne** de la Pi 5 sait faire les deux à la fois :

```
* #{ managed } <= 1, #{ AP } <= 1, ... total <= 4, #channels <= 1
```

Il peut donc porter **le point d'accès « Ofelia » ET une connexion cliente**,
à une condition : **les deux sur le même canal**. Comme le canal est imposé par
le routeur auquel on se connecte, l'AP devrait suivre celui de la box internet.

À Canaima, la question ne se pose pas : pas d'internet, donc pas de client —
l'AP est libre de son canal. La contrainte ne pèse que sur le réseau de Val.

**Cela supprimerait le besoin du dongle**, sans rien acheter.

## Où le dongle reste utile

Nulle part sur cette Box : à Canaima il n'y a **aucun réseau** auquel se
connecter. Le dongle ne sert que chez Val, où un câble Ethernet est de toute
façon disponible.

## ✅ La solution : un port USB 2.0

Val a déplacé le dongle sur un **port noir (USB 2.0)**. Le défaut a disparu
d'un coup :

| | Ports bleus (USB 3) | Port noir (USB 2) |
|---|---|---|
| Ré-énumérations | **101** en une session | **0** |
| Erreurs `usb read32` | 56 | **0** |
| Déconnexions | toutes les 15 s | **0** |
| Bande | 2,4 GHz, jamais associé | **5 GHz, −46 dBm** |
| Adresse | aucune | `192.168.0.205` (réservée) |

⚠️ **Mon diagnostic était à côté.** J'avais relevé les 480 Mb/s dans un port
bleu et conclu à un mauvais contact SuperSpeed ; puis, constatant que
l'adaptateur déclare `bcdUSB 2.00`, j'en ai déduit que **le type de port
n'avait aucune importance**. C'est cette seconde conclusion qui était fausse.

L'explication tient à ce qu'un port USB 3 fait, pas à la vitesse qu'il négocie :
son circuit SuperSpeed **rayonne du bruit radio dans la bande 2,4 GHz** — c'est
un phénomène documenté — et le contrôleur xHCI ne se comporte pas de la même
façon selon la voie utilisée. Un périphérique peut donc énumérer en USB 2 dans
un port bleu **et souffrir malgré tout** de son voisinage.

**Règle à retenir : sur cette Box, le dongle Wi-Fi va dans un port NOIR.**

## 🔴 Le gel de la Box — cause établie

Le 2026-08-26 vers 12h24, déplacer le dongle à chaud a **fait tomber toute la
machine** : plus de SSH ni de HTTP sur aucune adresse, LED rouge fixe sans
activité de la carte SD.

Les journaux persistants — activés la veille (FEAT-038) — ont permis de le lire
au lieu de le supposer :

```
usb 3-1: new high-speed USB device number 101     ← 101 re-enumerations
rtw89_8852bu: failed to poll nctl block
rtw89_8852bu: MAC has already powered on
… puis le journal s'arrete net, sans message d'arret
```

Le pilote tournait en boucle de réinitialisation depuis des heures ; le gel est
survenu pendant l'un de ces cycles. Aucune trace de panique : un blocage franc.

**C'est la première panne de cette Box qu'on explique au lieu de la
reconstituer.** Sans journal persistant, on en serait resté à « elle a planté
quand j'ai touché au dongle ».

⚠️ **Retirer à chaud un périphérique dont le pilote boucle peut figer le
noyau.** Éteindre la Box avant de manipuler un périphérique instable.

## Ce qui a été mis en place malgré tout

Deux réglages persistants, qui ne coûtent rien et pourraient servir si le
défaut est marginal :

| Fichier | Effet |
|---|---|
| `/etc/modprobe.d/rtw89-ofelia.conf` | `disable_ps_mode=Y` au chargement du module |
| `/etc/udev/rules.d/50-ofelia-wifi-dongle.rules` | veille USB désactivée **à chaque** ré-énumération |

## L'architecture réseau est rétablie sans lui

Le point d'accès a été basculé sur `wlan0` **sans attendre** la réparation du
dongle : il ne dépend pas de lui.

```
wlan0  Ofelia-AP   192.168.50.1   SSID « Ofelia », canal 11, 31 dBm
eth0   câble       192.168.0.147  (adresse réservée)
wlan1  dongle      hors service
```

Portail vérifié sur `http://192.168.50.1/` → **HTTP 200**.

⚠️ **La bascule a été faite avec un retour arrière automatique armé à 3
minutes** : `wlan0` portait l'accès SSH, et le dongle ne pouvait pas prendre le
relais. Sans le câble Ethernet branché par Val, l'opération aurait été
imprudente — une erreur de configuration aurait rendu la Box injoignable.

## Conséquence pratique

L'architecture voulue est **en place et fonctionnelle** :

```
wlan0  Ofelia-AP   192.168.50.1   point d'acces des bibliothecaires
wlan1  dongle      192.168.0.205  maintenance, 5 GHz — port USB 2 NOIR
eth0   cable       192.168.0.147
```

Le dongle n'est donc **pas** à remplacer. Il reste néanmoins servi par un
pilote fragile (`rtw89_8852bu`, noyau 6.12/6.18) : si l'instabilité revenait, un
modèle à puce mieux supportée sous Linux — Realtek RTL8188 ou MediaTek MT7601 —
serait plus sûr pour un site isolé.
