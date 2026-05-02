# BUG-014 — Wikipedia : articles sans images (comportement attendu)

**Status:** BY DESIGN  
**Date:** 2026-05-01

## Symptom

Les articles Wikipedia affichés via Kiwix n'ont pas d'images.

## Explanation

Le ZIM installé est `wikipedia_es_all_nopic_2026-02.zim` — le suffixe `_nopic` signifie
explicitement "sans images". Ce ZIM est choisi pour son faible poids (3.4 Go vs ~85 Go
pour la version avec images).

## Options

- Version avec images : `wikipedia_es_all_maxi` (~85 Go) — disponible sur
  `https://download.kiwix.org/zim/wikipedia/`
- Ajouter cette option dans le wizard si l'utilisateur a suffisamment d'espace disque

## Not a bug

Il s'agit du comportement attendu du ZIM sélectionné.
