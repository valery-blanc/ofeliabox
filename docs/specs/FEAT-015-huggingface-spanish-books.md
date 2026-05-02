# FEAT-015 — Bibliothèque HuggingFace : livres espagnols domaine public

**Status:** IN PROGRESS — Option B+C confirmée  
**Date:** 2026-05-01

## Context

Dataset HuggingFace : https://huggingface.co/datasets/PleIAs/Spanish-PD-Books
Livres en espagnol dans le domaine public (~50 000+ textes).

L'utilisateur souhaite :
1. Télécharger tout ou partie de cette bibliothèque
2. Pouvoir rechercher des ouvrages et les télécharger sur la box hors-ligne

## Options à évaluer

**Option A — Kiwix ZIM custom**  
Convertir le dataset en ZIM (nécessite `zim-tools`). Lourd à maintenir.

**Option B — Calibre-web**  
Serveur de bibliothèque EPUB/PDF. Peut indexer les fichiers téléchargés.
Image Docker : `lscr.io/linuxserver/calibre-web:latest`
Accès : `/calibre/`

**Option C — Script de téléchargement sélectif**  
Script qui liste les titres disponibles (API HuggingFace) et télécharge le PDF/EPUB
sélectionné. Intégrable au portail comme un moteur de recherche.

## Recommendation

Option B + Option C combinées :
1. Télécharger le catalogue (index léger)
2. Calibre-web pour browse + download à la demande
3. Intégrer dans le wizard comme option "Bibliothèque PD Espagnol"

## Research needed

- Taille totale du dataset (PDFs)
- Format des fichiers (PDF ? EPUB ? TXT ?)
- API HuggingFace pour listing et téléchargement sélectif
- Compatibilité bras64 de Calibre-web
