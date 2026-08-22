# FEAT-035 — L'assistant parle six langues, et un outil garantit qu'il les parle toutes

**Statut :** FAIT, validé par Val — 2026-08-22

---

## Le problème, et la façon dont je l'ai d'abord mal traité

L'assistant d'administration était **intégralement en français**, alors que le
portail public, la page de démarrage et BibliOfelia sont traduits. À Canaima,
la personne qui administre la Box parle espagnol : lui laisser la seule
interface de configuration en français est un obstacle réel.

Première tentative : j'ai relevé les chaînes **à la lecture** et traduit ma
liste. J'ai couvert **39 chaînes sur 104** et annoncé la tâche terminée. Val a
dû me répondre qu'il en manquait « trop pour que je fasse la liste ».

L'outil écrit ensuite a trouvé les 65 restantes en une passe — dont une source
entière que je n'avais pas envisagée : **les textes écrits par le
JavaScript**.

## `scripts/i18n_audit_setup.py`

Recense tout le texte visible et dit lequel est couvert. Code de sortie 1 s'il
en reste — utilisable comme garde-fou avant commit, comme `i18n_check.py` pour
BibliOfelia.

```bash
python3 /opt/edubox/scripts/i18n_audit_setup.py
```

Trois sources, parce que le texte vient de trois endroits :

| Source | Contenu | Mon oubli initial |
|---|---|---|
| Gabarit HTML | textes, `placeholder`, `title`, `alt` | partiel |
| **JavaScript** | « Scan en cours… », « Connexion à … » | **entièrement manqué** |
| `app.py` | catalogues rendus côté serveur | non regardé |

### Trois faux signalements corrigés

Un outil qui crie au loup finit par être ignoré :

- **Les commentaires français** étaient pris pour des chaînes : leurs
  apostrophes (`n'est`, `d'un`) sont lues comme des délimiteurs et décalent
  toute l'analyse. L'audit les blanchit avant de chercher.
- **Les tailles de fichiers** (« 3.4 Go ») étaient signalées. Elles ne se
  traduisent pas : le moteur convertit `Go`→`GB` hors français à l'affichage.
- **Les catalogues d'`app.py`** l'étaient à tort — le gabarit ne contient
  aucune balise Jinja, donc `render_template(..., apps=APPS)` passe des
  données que personne n'affiche.

## Le mécanisme

- `data-i18n="cle"` sur l'élément, `data-i18n-ph` pour un `placeholder`.
- `window.oT('cle')` pour les textes écrits par le code.
- **Le moteur est injecté en tête de page**, juste après `<body>`. Placé avant
  `</body>`, il arrivait trop tard : le JavaScript appelle `oT()` dès son
  exécution.
- **Même clé de stockage que le portail public : `localStorage['ofelia-lang']`**
  — le choix de langue suit l'utilisateur d'une page à l'autre.
- Un `MutationObserver` réapplique après chaque salve de modifications du DOM :
  beaucoup de contenu apparaît après des appels réseau.
- **Les tuiles sont marquées automatiquement via leur `data-id`** : une tuile
  ajoutée plus tard est reconnue sans retoucher le script, il ne reste qu'à
  ajouter sa traduction.

## Résultat

| | Avant | Après |
|---|---|---|
| Chaînes non traduites | 104 | **0** |
| Dictionnaire | — | **105 clés × 6 langues** (fr, en, es, pt, it, de) |
| Clés utilisées sans traduction | — | aucune |
| Clés définies jamais utilisées | — | aucune |

## La limite de l'audit, trouvée par Val

Après un audit à zéro, Val a repéré à l'écran un texte encore en français :
**« Parcourir… »**, le bouton de `<input type="file">`.

Ce texte n'est nulle part dans notre code : c'est le **navigateur** qui le
dessine, dans *sa* langue. Aucun attribut ne peut le traduire — il faut
masquer le contrôle natif et poser un `<label>` par-dessus.

**Un audit vert ne prouve pas que l'interface entière est traduite.** Il prouve
que tout le texte *de notre code* l'est. Toujours finir par un coup d'œil sur
la page réelle, dans une autre langue que le français.

Le champ concerné a été retiré (FEAT-036), le point est consigné en mémoire.

## Deux erreurs commises pendant la correction

L'audit a **immédiatement signalé** que le message de confirmation ajouté pour
BUG-035 était en français en dur — c'est exactement son rôle, et la raison de
le lancer après *chaque* modification, pas seulement en fin de chantier.

Puis mon correctif a cassé le JavaScript : dans un remplacement `re.sub`, la
séquence `\n` de la chaîne de remplacement est interprétée comme un vrai saut
de ligne. Repéré par `node --check`, corrigé avec une fonction de remplacement
(qui ne traite aucun échappement).
