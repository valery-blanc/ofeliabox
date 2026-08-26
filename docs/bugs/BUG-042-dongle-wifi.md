# BUG-042 — Le dongle Wi-Fi se déconnecte toutes les 15 secondes

**Statut :** DIAGNOSTIQUÉ — cause matérielle ou pilote, test décisif à faire par Val
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

Tant que le dongle n'est pas réparé ou remplacé, **la Box n'a pas d'accès
internet sans câble**. À Canaima, où il n'y aura ni câble ni réseau, ce n'est
pas bloquant pour les usagers — le point d'accès suffit. Mais Val perd la voie
de maintenance à distance, et ZeroTier avec elle.
