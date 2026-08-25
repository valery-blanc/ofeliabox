# BUG-036 — La page de démarrage affichait un verdict périmé

> ⚠️ Depuis FEAT-037, cette page vit à `:8080/boot`. `/demarrage` y
> redirige encore. Les adresses citées ci-dessous sont celles de l'époque.


**Statut :** CORRIGÉ et vérifié — 2026-08-22
**Signalé par Val :** « il affiche bibliofelia en erreur alors que bibliofelia
fonctionne très bien »

---

## Deux défauts, un symptôme

### 1. La page se refermait toute seule

Ouvrir `:8080/demarrage` volontairement renvoyait vers le portail au bout de
2,5 secondes. La bascule est voulue **pendant** un démarrage, mais elle
empêchait de consulter la page — ou d'y régler l'heure.

**Correctif :** on ne bascule que si la page a *réellement assisté* à la
séquence, c'est-à-dire si elle a vu l'état `encours` de son vivant.

| Situation | Comportement |
|---|---|
| Ouverture volontaire, séquence finie | reste sur la page |
| Démarrage réel (encours → terminé) | bascule vers le portail |
| Arrivée pendant un démarrage | bascule vers le portail |

### 2. L'état était figé à l'instant du démarrage

Le fichier `boot-status.json` datait du démarrage de 13 h 20 — celui où le
plafond d'attente avait été franchi par le saut d'horloge (BUG-035).
BibliOfelia y était noté « ne répond pas » et le **restait indéfiniment**,
affiché des heures plus tard comme un constat courant.

Même défaut que le champ d'heure périmé : **une information fausse présentée
avec assurance**. Un état figé au démarrage ne peut pas décrire une Box qui
tourne depuis.

**Correctif :** `GET /api/boot-status` revérifie les étapes en échec au moment
de la lecture, et corrige le fichier sur le disque. Seulement celles-là — une
étape prête n'est jamais resollicitée, la page reste légère.

L'orchestrateur publie l'URL de vérification de chaque étape dans le fichier
d'état, pour que l'assistant sache quoi retester sans dupliquer la liste.

## Un bogue trouvé en corrigeant

La revérification échouait **en silence**. Les URL du fichier sont
`http://localhost/…`, écrites par l'orchestrateur qui tourne **sur l'hôte**, où
`localhost` désigne nginx. L'assistant tourne dans un conteneur, où `localhost`
désigne le conteneur lui-même.

Les URL sont désormais traduites vers `http://edubox-nginx` avant usage.

## Vérification

| Cas | Résultat |
|---|---|
| BibliOfelia (fonctionne) | passe à **prêt**, marqué « revérifié » |
| Service volontairement injoignable | **reste en erreur** |
| Fichier sur le disque | corrigé |

Le second point est le plus important : sans lui, la revérification masquerait
les vraies pannes au lieu de corriger les faux positifs.
