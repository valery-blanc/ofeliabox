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

## Reste à traiter

- Assistant : le scan des réseaux Wi-Fi ne fonctionne pas
- Assistant : pas de bouton « modifier » par mot de passe
- Assistant : BibliOfelia absente de la liste des mots de passe modifiables
- Kolibri : configuration à intégrer à l'installation ; Khan Academy introuvable
