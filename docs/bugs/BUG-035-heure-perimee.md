# BUG-035 — Le réglage manuel de l'heure a reculé l'horloge d'un jour

**Statut :** CORRIGÉ, horloge rétablie — 2026-08-22
**Gravité :** élevée — des dates de prêt fausses en auraient découlé sur site
**Origine :** régression introduite par FEAT-034, la fonction censée protéger l'heure

---

## Ce qui s'est passé

Découvert en vérifiant autre chose : la Box était au **21 août à 21:22** alors
qu'il était le **22 août à 21:25**. Exactement 24 heures de retard, et la
synchronisation NTP **désactivée**.

Le journal donne le moment précis :

```
2026-08-22T21:10:31  systemd-timedated: Set NTP to be disabled.
2026-08-21T21:19:03  ← la date recule d'un jour
```

## Cause racine

Le champ « Date et heure » était pré-rempli **au chargement de la page** et ne
se rafraîchissait jamais :

```js
// Pré-remplir avec l'heure du navigateur, presque toujours juste.
(function () { document.getElementById('cp-dt').value = /* maintenant */; })();
```

Sur un onglet resté ouvert depuis la veille, il proposait encore
`2026-08-21 21:19`. Un clic sur « Mettre à l'heure » a appliqué cette valeur
telle quelle — et coupé NTP, **par conception**, puisque c'est nécessaire pour
qu'un réglage manuel tienne.

Le résultat est l'inverse du but recherché : une fonction conçue pour corriger
l'heure sur un site sans internet l'a **faussée** sur une Box qui en avait, et
a désactivé le seul mécanisme capable de s'en apercevoir.

## Dégâts

**Aucun.** Vérifié dans la base BibliOfelia : le dernier enregistrement date du
2026-07-09, rien n'a été écrit pendant la fenêtre. Sur site, ç'auraient été des
dates d'emprunt et d'échéance.

## Correctif

1. **Le champ se rafraîchit chaque seconde** tant que personne n'y a touché
   (ni événement `input`, ni focus — sinon on écraserait une saisie en cours).
   Il ne peut donc plus être périmé.
2. **Si le champ n'a pas été modifié, on envoie `Date.now()`** plutôt que son
   contenu. Le cas « je clique sans rien saisir », de loin le plus fréquent,
   devient exact par construction.
3. **Un écart de plus d'une heure avec l'horloge du navigateur demande
   confirmation**, en affichant les deux dates. Une correction volontaire reste
   possible ; une fausse manœuvre ne passe plus en silence.

Appliqué aux deux pages : assistant et page de démarrage.

## Vérification

Logique rejouée sur le code réellement servi :

| Cas | Instant envoyé | Écart | Comportement |
|---|---|---|---|
| Champ non touché | maintenant | 0 h | appliqué directement |
| Valeur de la veille (21:19) | 2026-08-21 | **24,2 h** | **confirmation demandée** |

Horloge rétablie : `2026-08-22 21:26`, NTP actif et synchronisé.

## Portée

La règle vaut pour **tout champ pré-rempli avec « maintenant »** : date
d'emprunt, date de retour, horodatage d'inventaire. Consignée en mémoire
projet (`feedback_time_prefill_stale`).
