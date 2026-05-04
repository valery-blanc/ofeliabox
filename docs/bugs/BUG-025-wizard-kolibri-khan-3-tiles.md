# BUG-025 — Wizard Kolibri : 3 tuiles Khan Academy EN/ES/FR

**Status:** FIXED — confirmé OK le 2026-05-04
**Date:** 2026-05-04

## Symptom

Le wizard n'affichait que 2 tuiles Kolibri (khan_es et khan_fr) au lieu de 3, et `khan_es` utilisait l'ID du canal anglais (`1ceff53605e55bef987d88e0908658c5`) au lieu de l'ID espagnol correct.

## Reproduction steps

1. Ouvrir le wizard EduBox
2. Section Kolibri → 2 tuiles seulement (pas de tuile EN)
3. Cocher khan_es → import du canal anglais (mauvais contenu)

## Root cause

- `khan_en` manquait dans `KOLIBRI_CHANNELS` de `setup/app.py`
- `khan_es` avait `channel_id = "1ceff53605e55bef987d88e0908658c5"` (ID anglais)
- IDs corrects vérifiés via communauté Learning Equality

## Fix applied

`setup/app.py` — `KOLIBRI_CHANNELS` corrigé :
- `khan_en` ajouté : `channel_id = "1ceff53605e55bef987d88e0908658c5"`
- `khan_es` corrigé : `channel_id = "c1f2b7e6ac9f56a2bb44fa7a48b66dce"`
- `khan_fr` inchangé : `channel_id = "878ec2e6f88c5c268b1be6f202833cd4"`

`setup/templates/index.html` — tuile `khan_en` (🇬🇧) ajoutée dans la grille Kolibri.

Déployé sur Pi + restart `edubox-setup` le 2026-05-04.

## Spec section impacted

`docs/specs/specs_keebee.md` § Kolibri — canaux disponibles
