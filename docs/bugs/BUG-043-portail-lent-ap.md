# BUG-043 — Le portail est lent et expire depuis le Wi-Fi de la Box

**Statut :** CORRIGÉ — en attente du test de Val
**Signalé par :** Val, 2026-08-26 — « le wifi Ofelia marche mais le portail est
très lent et fait des timeout. l'assistant a l'air de fonctionner normalement »

---

## Ce que les journaux montrent

L'écart entre le portail et l'assistant est la première piste : le portail
passe par nginx et charge des images, l'assistant est servi directement et n'en
charge presque pas.

Les journaux nginx donnent la preuve :

```
10:10:29  GET /assets/logo.png  200  87 851 octets
10:10:39  GET /assets/logo.png  206  47 307      ← reprise, transfert coupé
10:11:10  GET /assets/logo.png  206  47 307      ← coupé de nouveau
10:11:11  GET /wizard-state.json 200
```

**42 secondes pour un seul logo**, avec deux reprises partielles (`206`).

## Deux causes, cumulatives

### 1. Le portail pesait 773 Ko d'images pour 19 Ko de HTML

| Fichier | Avant | Constat |
|---|---|---|
| `bg.png` | **649 Ko**, 1920×1080 | une **photographie** stockée en PNG palette 256 couleurs — le pire format possible : la palette avait déjà dégradé la photo, et le PNG la stocke mal |
| `logo.png` | 86 Ko, **2560 px** de large | affiché à 400 px au plus : six fois trop de pixels téléchargés pour être jetés |

Sur un point d'accès 2,4 GHz servi par une Pi, c'est le facteur dominant.

**Corrigé :**

| Fichier | Avant | Après | Gain |
|---|---|---|---|
| fond | 649 Ko PNG | **100 Ko JPEG** 1280×720 | −85 % |
| logo | 86 Ko | **35 Ko** PNG 800 px | −59 % |
| **page complète** | **773 Ko** | **170 Ko** | **−78 %** |

Le fond passe en JPEG parce que c'est une photo **et qu'elle est opaque** —
vérifié avant conversion. Le logo **garde de la transparence**, il reste donc en
PNG : le convertir aurait posé un fond noir derrière.

### 2. L'économie d'énergie était active sur l'interface du point d'accès

`brcmfmac` l'active à chaque montée de l'interface :

```
brcmfmac: brcmf_cfg80211_set_power_mgmt: power save enabled
```

Sur une interface **cliente**, c'est utile. Sur un **point d'accès**, c'est
nuisible : la radio s'endort entre deux balises, les trames des clients
arrivent en retard ou se perdent, et les transferts se coupent en plein
milieu — exactement les `206` observés.

**Corrigé**, et rendu persistant : un réglage posé à la main ne survit ni au
redémarrage ni à une simple reconnexion de l'interface. D'où
`/etc/NetworkManager/dispatcher.d/90-ofelia-ap-powersave`, appelé par
NetworkManager à chaque montée, et qui n'agit **que sur une interface en mode
AP** — sur une interface cliente l'économie d'énergie reste souhaitable.

## Ce qui est écarté

| Hypothèse | Réfutation |
|---|---|
| Serveur lent | Toutes les routes répondent en **moins d'une milliseconde** depuis la Box |
| DNS de l'AP | Résolution en 0,00–0,01 s pour les trois sondes de portail captif |
| Liaison radio faible | 65 / 72,2 Mbit/s, `tx failed: 0`. Le 1 Mbit/s relevé une fois était **transitoire**, au moment de l'association |
| `/api/status` lent | 72 ms |

⚠️ 26,9 % de paquets marqués « perdus » en réception sur `wlan0` — chiffre
cumulé depuis le démarrage, dont une partie est du bruit normal en 2,4 GHz
encombré (20 réseaux détectés alentour). À surveiller, pas à interpréter seul.

## Fichiers

| Fichier | Nature |
|---|---|
| `portal/assets/bg.jpg` | nouveau — remplace `bg.png`, supprimé |
| `portal/assets/logo.png` | ré-échantillonné à 800 px |
| `portal/index.html` | référence `bg.jpg` |
| `network/dispatcher.d/90-ofelia-ap-powersave` | nouveau — versionné, installé dans `/etc/NetworkManager/dispatcher.d/` |

⚠️ Le script du répartiteur doit appartenir à **root** et n'être inscriptible
que par lui, sinon NetworkManager l'ignore **en silence**.
