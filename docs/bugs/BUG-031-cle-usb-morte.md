# BUG-031 — Mort de la clé USB de sauvegarde, en silence

**Statut :** DIAGNOSTIQUÉ — matériel HS, système durci pour la suite
**Date :** 2026-08-21, 14h26

---

## Ce qui s'est passé

La clé Kingston DataTraveler 3.0 (32 Go), formatée et mise en service le
matin même, s'est déconnectée **d'elle-même** à 14:26:30. Personne n'y avait
touché, et aucun port USB n'avait été manipulé.

```
14:26:30  usb 4-1: USB disconnect, device number 6        ← Kingston disparaît
14:26:34  New USB device: idVendor=13fe, idProduct=5500
          Product: 2306 Boot ROM
          Manufacturer: Phison                            ← identité différente !
14:26:39  sd 0:0:0:0: [sda] Media removed, stopped polling ← 0 octet
14:32→14:48  six « reset SuperSpeed USB device »
14:51:56  usb 4-1: USB disconnect                         ← ne s'énumère plus du tout
```

## Diagnostic

La clé n'est pas revenue sous son identité Kingston (`0951:1666`) mais sous
celle du **contrôleur nu Phison en mode « Boot ROM »** (`13fe:5500`).

Phison fabrique les contrôleurs équipant les clés Kingston. Le mode Boot ROM
est la ROM de secours du contrôleur : il s'y replie lorsqu'il **n'arrive plus
à charger son propre micrologiciel depuis la mémoire flash**. Le contrôleur
répond encore sur le bus USB, mais ne présente plus aucun support — d'où le
`sda` de 0 octet.

C'est une panne matérielle définitive de la clé, pas un incident logiciel :

- **Ce n'est pas l'alimentation** : `throttled=0x0`, aucune sous-tension.
- **Ce n'est pas le formatage** : écrire trois fois 17 Mo ne tue pas une clé
  saine. Défaut de jeunesse ou clé défectueuse d'origine.
- **Ce n'est pas récupérable par logiciel** : un cycle d'alimentation
  complet du bus USB (`authorized` 0 → 1) n'a rien ramené ; la clé ne
  s'énumère plus.

## Le vrai problème : la panne était silencieuse

Le garde-fou du script a bien joué son rôle — refus d'écrire sur la carte SD
plutôt que de la remplir. Mais **rien ne signalait l'arrêt des sauvegardes**.
Sur un site distant sans personnel technique, la panne aurait pu passer
inaperçue pendant des mois, et n'être découverte qu'au moment d'avoir besoin
d'une restauration.

## Corrections apportées

### 1. Une clé de remplacement fonctionne sans configuration

`/etc/fstab` visait l'**UUID** de la clé morte : une clé neuve, ayant un
UUID différent, n'aurait jamais été montée et le système serait resté inerte.
Le montage se fait désormais par **étiquette** :

```
LABEL=OFELIA_BACKUP  /mnt/backup  ext4  defaults,noatime,nofail,x-systemd.automount,…
```

### 2. `scripts/preparer-cle-backup.sh`

Prépare une clé neuve en une commande : détection des clés USB (les disques
non amovibles sont exclus, impossible de viser la carte SD), confirmation
explicite par « OUI », formatage ext4 + étiquette, mise à jour de `fstab`,
copie du script de reprise, première sauvegarde immédiate.

```bash
sudo /opt/edubox/scripts/preparer-cle-backup.sh
```

### 3. État des sauvegardes visible

- `GET /api/backup/status` — clé présente, date et âge de la dernière
  sauvegarde, espace libre, nombre de sauvegardes conservées.
- Bandeau en haut du portail d'administration : **rouge** si la clé manque,
  **orange** au-delà de 48 h sans sauvegarde, vert sinon. Rafraîchi toutes
  les 2 minutes.

### 4. Le script de reprise ne vit plus uniquement sur la clé

`RESTAURER-OFELIA.sh` est désormais versionné dans `scripts/`. La clé n'en
reçoit qu'une copie : une clé morte n'emporte plus le script avec elle.

## Ce qui a été perdu

Les trois sauvegardes présentes sur la clé (17 Mo, 17 Mo, 11 Mo). **Sans
conséquence** : les données vivantes sont intactes sur la Box, et une
sauvegarde complète a été reprise et vérifiée avant le départ.

## Sauvegarde hors-Box du 2026-08-21

La Box partant sur site sans clé, une archive a été déposée sur le poste de
Val — `C:\work\BibliOfelia\_snapshots\ofelia-backup-20260821-1456.tgz`
(11 Mo) : base BibliOfelia, dump MariaDB, médias, configuration complète,
profils réseau.

**Vérifiée, pas seulement copiée :**

```
PRAGMA integrity_check → ok
catalog_item     953 lignes
members_member    22 lignes
loans_loan         3 lignes
dump MariaDB     lisible
```

## Reste à faire

Brancher une clé neuve et lancer `preparer-cle-backup.sh`. Tant que ce n'est
pas fait, **la Box n'a aucune sauvegarde automatique** et le bandeau rouge du
portail d'administration le rappellera.
