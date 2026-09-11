# BUG-041 — Retours du test de Val sur la Box remontée

**Statut :** EN COURS — lot 1 corrigé, en attente du test de Val
**Source :** `temp.txt`, 2026-08-26, après la remise en service sur carte neuve.

---

## 1. Impossible de se connecter à quoi que ce soit

> « Moodle : je n'ai pas réussi à me loguer avec les credentials qui sont dans
> l'assistant » · « BibliOfelia : les credentials ne sont pas dans l'assistant »
> · « Calibre : les credentials sont dans l'assistant mais vide »

Trois causes distinctes derrière un même symptôme :

| Application | Cause |
|---|---|
| Moodle | le dump MariaDB restauré a rétabli les mots de passe **d'avant le sinistre** ; l'assistant affichait ceux générés à l'installation |
| BibliOfelia | **absente** de `credentials-data.json` — jamais ajoutée depuis sa création |
| Calibre | présente, mais le mot de passe affiché ne correspondait plus à la base |

Et une cause de fond, qui explique que ça se reproduise : **`/api/update-credentials`
n'écrit que dans le fichier JSON.** Il ne change aucun mot de passe réel. Ce que
l'assistant montre est donc une note libre, sans lien garanti avec les
applications — un affichage qui dérive silencieusement à chaque restauration.

**Corrigé** — mot de passe unique `admin` / `Ofelia2026` sur les quatre
applications, appliqué **dans les applications elles-mêmes**, puis vérifié par
connexion réelle et non par lecture du fichier :

| Application | Vérification |
|---|---|
| BibliOfelia | POST de connexion → 302 vers `/fr/`, session ouverte |
| Moodle | POST de connexion → 303 `testsession`, signe d'authentification réussie |
| Calibre | POST de connexion → 302 vers `/calibre/`, hash validé par `check_password_hash` |
| Kolibri | `check_password()` → vrai |

⚠️ **La politique de mot de passe Moodle a dû être désactivée** :
`Ofelia2026` ne contient pas de caractère non alphanumérique, que Moodle exige
par défaut. Choix assumé pour une box hors-ligne confiée à des bibliothécaires,
mais c'est un assouplissement réel.

⚠️ **MariaDB garde son mot de passe généré** — compte de service, jamais saisi à
la main, et le changer casserait Moodle. Conforme à la consigne de Val.

Au passage : `credentials-data.json` contenait encore **Koha, PMB et SLiMS**,
désinstallés depuis. Retirés.

Enfin, une tentative échouée était enregistrée par **django-axes** côté
BibliOfelia. Quelques essais de plus et le compte se verrouillait — un
bibliothécaire qui se trompe trois fois se serait retrouvé dehors sans
comprendre. Effacée.

## 2. Toutes les applications affichées « hors ligne »

> « Digistorm : hors ligne (page blanche) »

Val n'a signalé que Digistorm, mais **le défaut les touchait toutes**. Le
portail lisait :

```js
APPS.forEach(app => setStatus(app.id, data[app.id] || 'fail', t));
```

alors que `/api/status` renvoie `{"services": [{name, ok, status}, …]}` — un
**tableau**. `data['digistorm']` valait donc toujours `undefined`, et le
`|| 'fail'` marquait tout hors ligne, y compris ce qui tournait parfaitement.

**Corrigé des deux côtés** :

- le portail lit le format réellement servi, et une application absente du
  tableau de bord est affichée « en vérification » plutôt qu'« en panne » — ne
  pas savoir n'est pas la même chose que constater une panne ;
- le tableau de bord ne surveillait **ni Digistorm, ni BibliOfelia, ni Calibre**,
  et surveillait encore **Koha**. Liste refaite sur les applications réelles.
  Une alerte permanente pour un service absent apprend à ignorer les alertes.

Les trois bibliothèques hors-ligne (Wikipedia, Wikisource, Gutenberg) partagent
un seul conteneur : leur état est celui de Kiwix, via une table de
correspondance explicite.

La page blanche de Digistorm, elle, venait d'un tout autre problème, corrigé la
nuit même (commit `269dcfd`) : son point d'entrée avait changé de nom.

## 3. Pas de retour au portail depuis les bibliothèques

> « wikipedia, wikisource, Gutenberg : il n'y a pas le bouton maison qui
> retourne au portail (il y a un bouton maison mais qui retourne à `/wiki/`) »

Le bouton est injecté par nginx (`sub_filter '</body>' $back_btn`) dans cinq
applications — **mais pas dans Kiwix**. Celui que voyait Val était le bouton
natif de Kiwix, qui ramène à la liste des bibliothèques.

**Corrigé** : injection ajoutée sur `/wiki/` et `/wiki/viewer`.

⚠️ Détail qui aurait rendu la correction inopérante : sans
`proxy_set_header Accept-Encoding ""`, la réponse arrive compressée et
`sub_filter` n'a rien à substituer. Le bouton n'apparaîtrait jamais, sans la
moindre erreur.

## 4. Digistorm : le bouton maison sortait de la Box

> « quand on clique sur la maison on va vers `<ip>:3000/` au lieu de `<ip>` »

Digistorm est la **seule application servie en accès direct** (port 3000) et non
derrière nginx : le `sub_filter` n'a aucune prise sur elle.

La reproxifier aurait été la solution élégante, mais elle n'a pas de `base`
Vite configuré et sert ses ressources en chemins absolus : casser une
application tierce pour un bouton serait un mauvais marché. Le bouton a donc été
ajouté **à son propre rendu HTML**, avec le style de celui de nginx.

Son lien est calculé côté client — même hôte, sans le port — parce que
l'adresse de la Box dépend du chemin emprunté : câble, point d'accès Wi-Fi ou
ZeroTier. Un lien figé serait faux dans deux cas sur trois.

## 5. Le scan Wi-Fi de l'assistant ne trouvait jamais rien

> « le scan des wifi ne fonctionne pas »

`_wifi_client_iface()` **excluait `wlan0` en dur**, en supposant qu'il porte
toujours le point d'accès :

```python
if parts[1] == "wifi" and parts[0] != "wlan0":
    return parts[0]
```

Sur la Box remontée, c'est l'inverse : `wlan0` est le client (il porte l'accès
SSH) et `wlan1` est inutilisé. Le scan interrogeait donc une interface hors
service et renvoyait une liste vide — **sans la moindre erreur**, ce qui est le
pire des cas : rien à lire dans les journaux, juste un bouton qui ne trouve rien.

**Corrigé** : la règle en dur est remplacée par une détection des rôles réels.
`_wifi_ap_iface()` lit dans NetworkManager quelle interface porte le point
d'accès ; le client est choisi parmi les autres, en préférant celle qui est
déjà connectée — c'est le meilleur indice qu'elle fonctionne, un dongle en panne
restant `unavailable`.

**Vérifié** : `/api/wifi/scan` → `found: true`, `iface: wlan0`, **20 réseaux**.

## 6. Un bouton de modification par mot de passe

> « pas de boutons modifier pour modifier un login/mot de passe (en mettre 1 par
> mot de passe) » · « manque BibliOfelia dans la liste »

La page était **écrite en dur, application par application**. D'où les trois
symptômes à la fois : BibliOfelia absente (jamais ajoutée), Koha/PMB/SLiMS
encore présents (désinstallés depuis), et un unique bouton global qui basculait
toute la page en édition.

**Le vrai défaut était plus profond** : `/api/update-credentials` n'écrivait
que dans le fichier JSON. Ce que l'assistant affichait était une note libre,
sans lien avec les applications — elle dérivait à chaque restauration. Un
bouton « modifier » branché dessus n'aurait fait que déplacer le problème.

**Corrigé en deux temps :**

1. **`POST /api/set-password`** change le mot de passe **dans l'application**.
   Chacune stocke ses comptes différemment — Django pour BibliOfelia, une CLI
   pour Moodle, werkzeug + SQLite pour Calibre, l'ORM pour Kolibri : il n'existe
   pas de mécanisme commun, d'où une fonction par application. Le fichier n'est
   mis à jour **que si l'application a accepté** : afficher un mot de passe qui
   ne fonctionne pas est exactement ce qu'on corrige.
2. **La page est engendrée depuis les données**, avec un bouton par ligne. Les
   applications sans mécanisme de changement (Digistorm, Portainer, MariaDB)
   sont en lecture seule, avec la raison affichée — proposer un bouton qui ne
   peut pas tenir sa promesse serait pire que ne rien proposer.

Deux détails qui comptent à l'usage : `set_password` efface aussi les tentatives
échouées de django-axes (sans quoi un compte verrouillé refuserait le nouveau
mot de passe sans rien expliquer), et en cas d'échec la saisie reste à l'écran
pour être corrigée sans tout retaper.

**Vérifié** — changement par l'API puis **connexion réelle** :

| Application | Changement | Connexion après |
|---|---|---|
| BibliOfelia | ok | 302 vers `/fr/` |
| Moodle | ok | 303 `testsession` |
| Calibre | ok | 302 vers `/calibre/` |
| Kolibri | ok | `check_password()` vrai |

Garde-fous : application inconnue → 400, mot de passe < 6 caractères → 400.

## 7. Kolibri : configuration et Khan Academy

> « est-ce que la procédure de configuration peut se faire pendant
> l'installation ? J'ai fait la procédure mais je ne retrouve pas Khan Academy »

**Oui, elle se fait pendant l'installation** — le mécanisme existe déjà :
`KOLIBRI_CHANNELS` déclare trois chaînes Khan Academy (anglais ~37 Go, espagnol
~37 Go, français ~10 Go) et `_import_kolibri_channel()` les télécharge.

Si Khan Academy est introuvable, ce n'est pas un défaut de configuration :
**Kolibri est vide**. `ChannelMetadata.objects.count()` → **0**, et
`data/kolibri` ne pèse que 5,4 Mo contre 74 Go avant le sinistre. Le contenu
n'était **pas dans la sauvegarde** et a disparu avec l'ancienne carte.

⚠️ **Le retéléchargement est une décision de Val** : 37 Go pour l'espagnol,
plusieurs heures, et le choix des chaînes lui appartient. À lancer depuis
l'assistant, section Kolibri.

## 8. Bibliothèque Calibre restaurée (2026-08-27)

La régénération étant cassée (BUG-044), la bibliothèque a été **récupérée sur
l'ancienne carte** puis remise en place : **150 555 livres, 70 677 auteurs**,
6,6 Go, lus par Calibre-Web depuis `/books`.

⚠️ **Piège rencontré : `/tmp` sur la Box est un disque en RAM de 2 Go.** Le
premier transfert de l'archive de 5,5 Go y a été **tronqué à 2 Go**, et `scp` a
signalé l'échec sur les fichiers *suivants* — pas sur l'archive elle-même. Les
gros transferts vont dans `/opt/edubox/restauration`, jamais dans `/tmp`.

Transfert fait **directement de Bruxelles vers la Box** (Bruxelles a
`id_ed25519_pi`), pour ne pas faire transiter 5,5 Go par le poste de Val.

Vérifications après remise en place : archive lisible (203 627 entrées),
catalogue `integrity_check: ok`, 150 555 livres vus par Calibre-Web, connexion
`admin` / `Ofelia2026` fonctionnelle, conteneur `healthy`.

## Reste à traiter## Reste à traiter

- ~~Assistant : scan Wi-Fi~~ — corrigé (§5)
- ~~Assistant : bouton par mot de passe~~ — corrigé (§6)
- ~~BibliOfelia dans la liste~~ — corrigé (§6)
- Kolibri : **contenu à retélécharger** (37 Go) — décision de Val (§7)
