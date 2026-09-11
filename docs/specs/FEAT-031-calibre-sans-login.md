# FEAT-031 — Calibre-Web consultable sans compte

**Statut :** FAIT et vérifié — 2026-08-21
**Demande de Val :** « est-ce qu'il serait possible de supprimer le login pour calibre ? »

---

## Contexte

Calibre-Web exigeait une connexion pour voir le moindre livre. Sur un site où
les usagers sont des lecteurs de passage, c'est un obstacle sans contrepartie :
le fonds est du domaine public, et distribuer un mot de passe à tout le monde
revient à ne pas en avoir tout en compliquant l'accès.

## Ce qui a été fait

Calibre-Web possède nativement un compte `Guest` et un réglage
`config_anonbrowse` — les deux étaient présents mais inactifs.

```
config_anonbrowse : 0 → 1
Guest role        : 32 → 290
```

Le rôle est un masque de bits :

| Bit | Droit | Donné à Guest |
|---|---|---|
| 32 | compte anonyme | oui |
| 2 | télécharger | oui |
| 256 | lire en ligne | oui |
| 4 | téléverser | **non** |
| 8 | modifier | **non** |
| 1 | administrer | **non** |

**La consultation est libre, la modification reste protégée.** Le compte
`admin` est inchangé et le lien de connexion reste présent dans le menu.

Le menu latéral de `Guest` reçoit la même valeur que celui de l'admin, sans
quoi la navigation par auteur, série ou catégorie serait vide.

## Vérification

| | Avant | Après |
|---|---|---|
| `GET /calibre/` sans session | 302 vers `/login` | **200** |
| Livres listés sur la page d'accueil | 0 | **192** |
| Téléversement / édition sans compte | — | refusés |

Une copie de la base a été laissée sur place avant modification :
`/config/app.db.bak-anonbrowse`.

## Réserve

Le réglage vit dans `/config/app.db`, un volume Docker — il survit à un
redémarrage et à une reconstruction d'image, mais **pas à une suppression du
volume**. Si Calibre est un jour réinstallé de zéro, l'opération est à refaire.
