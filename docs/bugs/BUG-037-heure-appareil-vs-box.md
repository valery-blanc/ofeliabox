# BUG-037 — La page de démarrage affichait deux heures sans dire lesquelles

**Statut :** CORRIGÉ — en attente du test de Val
**Signalé par :** Val, 2026-08-24 — « par contre le menu de réglage de l'heure en
bas de la fenêtre donne l'heure à Genève »

---

## Le symptôme

Sur `:8080/boot`, la carte « Date, heure et fuseau horaire » affiche :

- en gros, **10:35** — l'heure de la Box, réglée sur `America/Caracas` ;
- plus bas, un champ pré-rempli à **16:35** — l'heure du PC de Val, à Genève.

Deux horloges à dix centimètres l'une de l'autre, six heures d'écart, aucune
indication de ce que chacune représente. La lecture naturelle est que la page
se contredit.

## Ce qui n'était PAS en cause

Rien dans le réglage. Les deux horloges portent le **même instant** :

```
poste (Genève) : 16:35:13 — epoch 1787582113
Box  (Caracas) : 10:35:13 — epoch 1787582113   ← identique
```

Caracas est à UTC−4, Genève à UTC+2 en été : 6 h d'écart d'affichage, zéro
écart réel. Le bouton « Mettre à l'heure » envoie d'ailleurs un instant absolu
en millisecondes, pas une date écrite (FEAT-034) — cliquer n'aurait rien
décalé.

Le pré-remplissage par l'heure du navigateur est lui aussi délibéré : sur le
terrain, l'appareil du bibliothécaire est la référence la plus fiable pour
rattraper une Box dont l'horloge a dérivé.

## Le vrai défaut : une ambiguïté, pas un calcul

Le champ était étiqueté « Date et heure ». Rien ne disait *de quel appareil*.

Le risque n'est pas cosmétique : un bibliothécaire lisant la page comme Val l'a
lue peut conclure que la Box est déréglée et « corriger » une horloge juste.
BUG-035 a déjà montré qu'une fonction de correction peut devenir la cause de la
panne qu'elle prétend soigner.

## Le correctif

1. **L'étiquette nomme son horloge** : « Date et heure **de cet appareil** ».
2. **Une explication apparaît sous le champ, et seulement quand elle sert** :

   > Cet appareil est réglé sur Europe/Zurich (UTC+02:00), la Box sur
   > America/Caracas (UTC−04:00). C'est le même instant affiché dans deux
   > fuseaux différents — il n'y a rien à corriger.

3. **Six langues** (fr, en, es, pt, it, de), comme le reste de la page.

### La condition d'affichage compare les décalages, pas les noms

`Europe/Paris` et `Europe/Zurich` sont deux fuseaux distincts qui affichent la
même heure. Comparer les *noms* ferait apparaître une explication là où
l'utilisateur ne voit aucun écart — du bruit, et un doute créé de toutes
pièces. On compare donc les décalages effectifs en minutes ; à égalité, la
ligne reste masquée.

Le décalage de la Box vient de `utc_offset` (`/api/time-info`, format `-0400`),
celui de l'appareil de `getTimezoneOffset()` — qui compte **à l'envers**
(minutes à retirer pour obtenir UTC), d'où l'inversion de signe dans le code.
Le nom du fuseau de l'appareil vient de `Intl.DateTimeFormat()`, avec repli sur
le seul décalage si le navigateur ne le fournit pas.

## Fichiers

| Fichier | Nature |
|---|---|
| `portal/boot.html` | étiquette, ligne d'explication, style `.clock-hint`, 6 traductions, `majAstuceFuseau()` |

## Vérifications effectuées

- **Syntaxe du script** : analysée sans erreur (`new Function`, Node 22).
- **Conversion des décalages**, fonctions rejouées hors navigateur :
  `-0400` → −240 min → `UTC−04:00` · `+0530` → 330 → `UTC+05:30` ·
  `+0000` → 0 → `UTC+00:00` · chaîne vide → `null`, la ligne reste masquée.
- **Les six langues** produisent une phrase complète, avec les deux fuseaux
  correctement insérés. Aucune clé `tzHint` ou `dtLabel` manquante.
- **Gate i18n** : `python3 scripts/i18n_audit_setup.py` → **0 chaîne à
  traduire**, code de sortie 0.

⚠️ Ces vérifications portent sur la logique et les textes, rejoués hors
navigateur. **L'affichage réel dans la page reste à confirmer par Val** — c'est
précisément ce que ce correctif prétend améliorer.
