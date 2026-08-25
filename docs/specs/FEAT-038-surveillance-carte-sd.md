# FEAT-038 — Surveiller les blocages de la carte SD depuis l'assistant

**Statut :** IMPLÉMENTÉ — en attente du test de Val
**Demande :** « on va surveiller les freeze de la carte : on a un moyen de monitorer
ça et de l'afficher qqpart dans l'assistant ? »

---

## Le problème

Le 2026-08-25, la Box est restée bloquée au démarrage. La cause a fini par
apparaître dans `dmesg` :

```
mmc0: Card stuck being busy! __mmc_poll_for_busy
```

La carte cesse de répondre au contrôleur pendant des dizaines de secondes. Les
processus se figent en état `D` (attente disque ininterruptible), et comme
`sshd` est activé par socket, systemd accepte les connexions TCP sans jamais
démarrer le service : de l'extérieur, la Box « ne répond pas ».

**Rien de tout cela n'était visible sans se connecter en SSH et lire le journal
du noyau.** Sur un site distant, personne ne fera ça.

## Pourquoi mesurer les blocages et rien d'autre

Une carte SD ne rapporte **rien** à l'hôte : ni température, ni usure, ni
bridage. Il n'existe pas d'équivalent SMART pour ce format — c'est une limite
de la norme, pas un manque de l'outillage. Le seul signal observable est le
moment où elle cesse de répondre, que le noyau signale.

On y ajoute la **température du processeur** : sur une Pi 5, le lecteur de
carte est juste en dessous du SoC, donc c'est le meilleur indicateur indirect
de ce que subit la carte. Et les **drapeaux de sous-tension** de `vcgencmd`,
parce qu'une alimentation insuffisante produit exactement le même symptôme et
qu'il faut pouvoir l'écarter d'un coup d'œil.

## Architecture : l'hôte mesure, l'assistant affiche

L'assistant tourne dans un conteneur. Il ne voit ni `dmesg`, ni le journal de
la machine, ni `vcgencmd`. Lui donner ces accès signifierait monter
`/dev/kmsg`, le journal et des binaires de l'hôte — beaucoup de surface pour
peu de gain.

On reprend donc la mécanique déjà en place pour `boot-status.json` : **l'hôte
mesure et dépose un fichier, le conteneur le lit.**

| Étage | Fichier |
|---|---|
| Mesure | `scripts/sd-health.sh`, lancé par `ofelia-sd-health.timer` (90 s après le démarrage, puis toutes les 5 min) |
| Dépôt | `portal/sd-health.json`, écriture **atomique** (fichier temporaire puis `mv`) |
| Lecture | `GET /api/sd-health` dans `setup/app.py` |
| Affichage | panneau dans `setup/templates/index.html`, sous celui de l'horloge |

L'écriture atomique n'est pas de la coquetterie : sans elle, l'assistant
pourrait lire un fichier à moitié écrit et annoncer une panne de mesure.

## Ce que le panneau montre

Un état en gros — « Aucun blocage détecté » en vert, ou « N × la carte a cessé
de répondre » en rouge — puis le détail : blocages depuis l'allumage, sur 24 h,
sur 7 jours, date du dernier, température du processeur, sous-tension déjà
survenue, volume écrit depuis l'allumage.

En pied de panneau, deux informations qui évitent de mal lire le reste :
**l'âge de la mesure**, et **la date depuis laquelle le journal existe**. Sans
cette seconde date, « 0 blocage sur 7 jours » se lirait comme un bon bulletin
alors que le journal peut n'avoir que deux heures.

Le verdict se fonde sur les 24 h quand l'historique le permet, et sur le
démarrage courant sinon — annoncer « aucun blocage » en s'appuyant sur un
compteur absent serait un faux satisfecit.

Six langues, comme le reste de l'assistant (FEAT-035).

## Prérequis rendu possible au passage : les journaux persistants

Les compteurs sur 24 h et 7 jours n'ont de sens que si le journal survit aux
redémarrages. **Il ne survivait pas** : Raspberry Pi OS livre

```
/usr/lib/systemd/journald.conf.d/40-rpi-volatile-storage.conf  →  Storage=volatile
```

qui force le journal en RAM pour épargner la carte. Le choix se défend, mais il
a coûté une demi-journée d'enquête le 2026-08-25 : les journaux du démarrage
raté avaient disparu au redémarrage suivant, et la panne a dû être reconstituée
par inférence.

⚠️ **Un fichier `.conf.d/` prime sur `journald.conf`** : modifier ce dernier ne
sert à rien. La correction est une surcharge de rang supérieur,
`/etc/systemd/journald.conf.d/50-ofelia-persistant.conf`, avec
`Storage=persistent` et `SystemMaxUse=200M`. Le plafond compte : sans lui, on
remplacerait un problème par un autre.

## Mesurer la DURÉE, et pas seulement le nombre

Demande de Val : « on peut rajouter un log pour savoir combien de temps dure un
calage ? » Elle est juste — dix blocages d'une seconde et un blocage de cinq
minutes ne se ressemblent en rien pour un bibliothécaire.

**Le noyau ne peut pas y répondre.** Il annonce qu'une carte cale, jamais
qu'elle repart : `Card stuck being busy` n'a pas de message jumeau de fin. La
durée ne peut donc venir que de l'observation directe.

`scripts/sd-stall-watch.py` échantillonne `/proc/diskstats` chaque seconde et
cherche une signature nette : **des requêtes en vol alors qu'aucune ne se
termine**. En marche normale, même sous forte charge, les compteurs de lectures
et d'écritures terminées avancent sans arrêt ; quand la carte se tait, ils se
figent alors que le compteur de requêtes en attente reste positif.

Il n'écrit sur le disque **qu'à la fin d'un blocage** : surveiller le stockage
en le sollicitant serait absurde.

### La définition retenue, parce qu'elle change le chiffre

> durée = instant de reprise − dernier instant où des requêtes aboutissaient

Dater le blocage au premier échantillon figé le raccourcirait d'une période
d'échantillonnage — le temps de constater qu'il dure. Le premier jet faisait
exactement cette erreur : **les scénarios de test l'ont attrapée**, un blocage
fabriqué de 10 s étant rapporté à 9 s.

Un garde-fou : un blocage n'est retenu que si au moins un échantillon a
réellement montré des requêtes en attente sans progression. Sans lui, une
famine de processeur qui retarderait le réveil du mesureur lui-même serait
comptée comme un blocage disque.

### Vérification

`test_stall_watch.py` importe le **vrai** script et remplace ses entrées
(lecture de `/proc/diskstats`, horloge, sommeil) : c'est le code livré qui est
éprouvé, pas une copie du raisonnement.

| Scénario | Attendu | Obtenu |
|---|---|---|
| Charge soutenue, requêtes qui aboutissent | rien | rien |
| Blocage franc de 10 s | 10 s | **10 s** |
| Micro-pause de 2 s (sous le seuil de 3 s) | rien | rien |
| Disque au repos, rien en vol | rien | rien |
| Deux blocages successifs de 5 s et 6 s | 5 s, 6 s | **5 s, 6 s** |

Et sur la Box, sous charge réelle : **4,5 Go d'entrées-sorties, aucun faux
positif**.

## Fichiers

| Fichier | Nature |
|---|---|
| `scripts/sd-health.sh` | nouveau — la mesure |
| `scripts/sd-stall-watch.py` | nouveau — la durée des blocages |
| `systemd/ofelia-sd-stall-watch.service` | nouveau — démarre tôt, `Restart=always` |
| `systemd/ofelia-sd-health.service` | nouveau — exécution, en priorité disque `idle` |
| `systemd/ofelia-sd-health.timer` | nouveau — 90 s après le démarrage, puis toutes les 5 min |
| `setup/app.py` | `GET /api/sd-health` (derrière le mot de passe) |
| `setup/templates/index.html` | panneau, styles, 15 clés × 6 langues |
| `/etc/systemd/journald.conf.d/50-ofelia-persistant.conf` | hors dépôt — journaux persistants |

Le service tourne en `IOSchedulingClass=idle` et `Nice=15` : la mesure ne doit
jamais concurrencer les applications pour le disque, puisque c'est précisément
le disque qu'elle surveille.

## Vérifications effectuées

| Vérification | Résultat |
|---|---|
| Exécution manuelle du collecteur | JSON valide, valeurs cohérentes avec `dmesg` |
| Minuteur | `enabled` + `active`, prochaine exécution à +5 min |
| `GET /api/sd-health` sans session | **401** — la route est bien protégée |
| Syntaxe JavaScript de l'assistant | 6 blocs `<script>`, **tous analysés sans erreur** |
| Catalogue de traductions | 6 langues, **15/15 clés présentes dans chacune** |
| Gate i18n (`i18n_audit_setup.py`) | **0 chaîne à traduire**, code de sortie 0 |
| Journaux persistants | `/var/log/journal/.../system.journal`, 17 Mo |

Valeurs relevées à la mise en service : 2 blocages depuis l'allumage, dernier à
10:47:14, processeur à 71,9 °C, aucune sous-tension jamais survenue.

⚠️ **Non vérifié : le rendu visuel du panneau dans un navigateur.** La logique,
les traductions et la syntaxe ont été rejouées hors navigateur ; l'affichage
reste à confirmer par Val.
