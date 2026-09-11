# BUG-038 — La Box ne démarre plus : la carte SD cesse de répondre

**Statut :** CAUSE ÉTABLIE — atténuations appliquées, remplacement à décider
**Constaté :** 2026-08-25

---

## Le symptôme

La Box s'arrête au démarrage sur :

```
cannot open access to console, the root account is locked
```

C'est `sulogin` : systemd a basculé en **mode urgence** après l'échec d'une
étape précoce, et le compte root étant verrouillé (configuration normale de
Raspberry Pi OS), aucun shell ne peut être offert.

Après un appui sur Entrée le démarrage reprend et atteint un `login:`, mais la
Box reste inutilisable : **les ports 22, 80 et 443 acceptent la connexion sans
jamais répondre**, 8080 est fermé.

## La cause

```
mmc0: Card stuck being busy! __mmc_poll_for_busy
INFO: task kworker/0:0:9 blocked for more than 120 seconds.
Workqueue: events_freezable mmc_rescan
  __mmc_claim_host -> mmc_get_card -> mmc_sd_detect
```

**La carte SD cesse de répondre au contrôleur**, parfois plus de deux minutes.
Un fil du noyau lui-même reste bloqué à essayer de prendre la main sur le bus.

Un processus capturé en flagrant délit : `python manage.py migrate`, en état
**`D` (attente disque ininterruptible)**, pile noyau
`folio_wait_bit_common → filemap_read → ext4_file_read_iter`, sur la lecture
d'un `.pyc` de quelques kilo-octets — six minutes pour une seconde de calcul.

Cela explique l'ensemble : le mode urgence (un montage a expiré au démarrage),
et les ports qui acceptent sans répondre — `sshd` est **activé par socket**,
donc systemd accepte la connexion TCP lui-même puis ne parvient jamais à
démarrer le service.

## Les fausses pistes, et pourquoi elles tombent

| Hypothèse | Réfutation |
|---|---|
| Carte SD corrompue | Superbloc ext4 : **39 % occupé, `s_state=1` (démonté proprement), 0 erreur** |
| Disque plein par `backup.sh` (destination par défaut `/var/backups/edubox`, sur la carte) | 290 Go libres |
| Ligne `/etc/fstab` bloquante (clé USB morte) | La ligne porte `nofail,x-systemd.automount` ; c'est le **seul** endroit du dépôt qui écrit dans `fstab` |
| `fsck.vfat` manquant | Présent dans `/usr/sbin` |
| FAT32 de `/boot/firmware` corrompue | `chkdsk` : **aucune erreur**, seul le drapeau « sale » était posé |
| Sous-tension (cause n°1 de ce symptôme sur Pi) | `vcgencmd get_throttled` = **`0x0`**, aucun événement ; un seul périphérique USB |
| Carte contrefaite | `manfid 0x1b`, `oemid` « SM » : **Samsung authentique**, fabriquée 10/2025 |
| Surcharge d'écritures des logs (ramasse-miettes saturé) | **0,52 Go écrits en 3 h, 22 Ko/s au repos** ; et le processus bloqué l'était sur une **lecture** |

⚠️ **Leçon de méthode : un superbloc propre n'innocente pas le support.** Il
décrit l'état des données, pas la santé du matériel. Devant des services qui
acceptent le TCP sans répondre, lire `dmesg` **en premier**
(`grep -iE "mmc|i/o error|timeout"`) et l'état `D` des processus
(`/proc/<pid>/stack`), avant toute analyse du système de fichiers. Cette
inversion a coûté une demi-journée.

## Ce qui a été fait

**Atténuations et durcissements** (appliqués et vérifiés le 2026-08-25) :

1. **`nofail` sur `/boot/firmware`** dans `/etc/fstab` — une partition de
   démarrage récalcitrante ne peut plus faire basculer la Box en mode urgence.
   Sauvegarde horodatée conservée ; `daemon-reload` + `findmnt` OK.
2. **Journaux persistants** (voir FEAT-038) — la prochaine panne sera lisible.
3. **Journaux Docker plafonnés** à 3 × 10 Mo (`/etc/docker/daemon.json`) :
   ils étaient **sans limite**, 108 Mo accumulés, vidés à cette occasion.
   ⚠️ `log-opts` ne s'applique qu'aux conteneurs **recréés**.
4. **NTP réactivé** : la Box était restée au 24 août, synchronisation éteinte
   (séquelle de BUG-035). ⚠️ **La Box n'a pas de pile d'horloge**
   (`RTC time: 1970-01-01`) : sans NTP elle recule dans le temps à chaque
   allumage, en restaurant la dernière heure connue.
5. **FEAT-038** : surveillance des blocages, visible dans l'assistant.
6. **`scripts/durcir-boot.sh`** — les points 1 à 3 vivent dans `/etc`, donc
   hors du dépôt : une réinstallation les perdrait en silence, et la Box
   reconstruite retomberait dans l'angle mort qui a coûté une demi-journée
   ici. Le script est idempotent et appelé par `RESTAURER-OFELIA.sh`, qui
   **active** aussi `ofelia-sd-health.timer` — installé mais jamais démarré
   jusque-là.

**Sans effet** : rebrancher la carte (un blocage est survenu à la 5ᵉ minute du
démarrage suivant, comme avant).

## Ce qui reste ouvert

Le symptôme est identique que la faute vienne de **la carte** ou du **lecteur
de la Pi**, et la conséquence est opposée : garantie digitec (gratuit, carte
achetée en mai 2026) dans un cas, contournement par démarrage USB dans l'autre.

**Un seul test les distingue : démarrer sur une autre carte SD.**

Piste thermique soulevée par Val, non close : **70,8 °C au repos, aucun
ventilateur** (`cooling_device` absent). Sur une Pi 5 le lecteur est sous le
SoC. Les deux blocages du dernier démarrage sont survenus pendant la montée en
charge — donc au moment le plus chaud et le plus sollicité — et aucun ensuite,
en 2 h 30 au repos. Val installe un ventilateur ; FEAT-038 permettra de mesurer
l'effet au lieu de le supposer.

## 📋 Dossier de garantie — ce qui prouve la défaillance

Carte **Samsung 512 Go**, achetée en **mai 2026 chez digitec**, fabriquée
**10/2025** (`manfid 0x1b`, `oemid 0x534d` = Samsung authentique).

**Le symptôme, mesuré** — le noyau signale que la carte cesse de répondre au
contrôleur :

```
mmc0: Card stuck being busy! __mmc_poll_for_busy
```

**33 blocages en 22 minutes, 86 % du temps immobilisée**, moyenne 35 s, pic 81 s.
Un fil du noyau lui-même est resté bloqué **plus de 120 secondes** en tentant de
prendre la main sur le bus.

**Dégradation le jour même** :

| | 10 h | 16 h | 17 h |
|---|---|---|---|
| Blocages | 2 | 5 | **33** |
| Démarrage du noyau | 3,0 s | 3,0 s | **44,6 s** |

**Les causes alternatives, écartées par la mesure** :

| Hypothèse | Test | Résultat |
|---|---|---|
| Alimentation | `vcgencmd get_throttled` | **`0x0`** — jamais de sous-tension |
| Surchauffe | ventilateur installé | 70,8 → **36,7 °C**, blocages inchangés |
| Carte pleine | superbloc ext4 | **39 % occupée**, 290 Go libres |
| Système de fichiers | superbloc | **démonté proprement, 0 erreur** |
| Contrefaçon | `manfid` / `oemid` | Samsung authentique |
| **Lecteur de la Pi** | **autre carte, même lecteur** | **0 blocage sur 30 Go d'E/S** |

⭐ **La preuve décisive est la dernière** : le même lecteur, avec une autre
carte, ne produit aucun blocage. Le défaut suit la carte, pas la machine.

⚠️ **À ne pas cacher si digitec demande l'historique d'usage** : environ 25 Go
de lecture/écriture lui ont été demandés pendant les tests de diagnostic. Cela
n'aurait pas dû abîmer une carte saine, mais le fait mérite d'être dit.

## 💾 Données récupérées avant renvoi (2026-08-27)

Rien d'irremplaçable ne reste sur la carte. Dans
`C:\WORK\Backups\ofeliabox` sur **Bruxelles** :

| Fichier | Taille | Contenu |
|---|---|---|
| `calibre-books.tar` | 5,4 Go | **159 619 EPUB** + 44 008 fichiers d'identifiants |
| `calibre-metadata.db` | 137 Mo | le catalogue, `integrity_check: ok` |
| `calibre-web-app.db` | 0,1 Mo | comptes et réglages Calibre-Web |

**Vérifié, pas supposé** : 203 627 fichiers extraits sur 203 628 comptés sur la
carte ; 5 EPUB tirés au hasard, tous valides ; et surtout la correspondance
**exhaustive** catalogue ↔ archive — les 150 555 livres retrouvés, **0 manquant**.

⚠️ **Une première vérification annonçait 419 absents (0,28 %) : c'était mon test
qui comparait mal.** Calibre tronque les noms de dossiers trop longs, si bien que
la colonne `path` ne correspond plus au nom réel. La comparaison par
**identifiant de livre** — qui ne peut pas être tronqué — donne 0.

⛔ **Non sauvegardé, volontairement** : Kolibri (74 Go, retéléchargé), les ZIM
(12 Go, retéléchargés) et `parquet-import` (48,6 Go, dataset public — inutile
une fois les EPUB générés). Ce sont ces 49 Go qui rendaient une carte de 256 Go
trop juste.

## État des données

Aucune perte. Base BibliOfelia vérifiée (`integrity_check: ok`), **identique à
la sauvegarde du 21 août** — 953 exemplaires, 22 membres, 3 prêts. Instantané
supplémentaire pris le 2026-08-25 par sécurité.
