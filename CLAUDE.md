# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EduBox** — Serveur éducatif et bibliothèque hors-ligne sur Raspberry Pi 5.

Déploie sur un Raspberry Pi 5 un serveur tout-en-un (avec ou sans internet) qui :
- Crée un hotspot WiFi "EduBox" pour tablettes et smartphones
- Sert quatre applications via un portail captif :
  - **Moodle** (LMS, cours pré-installés) → `/moodle/`
  - **Kolibri** (éducation hors-ligne : Khan Academy, vidéos éducatives) → `/kolibri/`
  - **Koha** (gestion de bibliothèque, SIP2, scanner USB) → `/biblio/`
  - **Wikipedia ES** (Kiwix, ZIM hors-ligne) → `/wiki/`
- Monitoring et accès distant via ZeroTier VPN
- Résilience aux coupures d'électricité (ext4 journaling, MariaDB fsync, backup périodique)

**Spec principale** : `docs/specs/specs_keebee.md`
**Cible** : Raspberry Pi 5 (4 Go RAM), Raspberry Pi OS Lite 64-bit (Bookworm), SD 512 Go
**IP Pi (réseau local)** : `192.168.0.147`
**Connexion** : `ssh -i ~/.ssh/id_ed25519_pi val@192.168.0.147`
**Stack** : Docker Compose — MariaDB, Moodle, Kolibri, Koha, Nginx, Portainer, Healthcheck

---

## Connexion SSH au Pi

```bash
ssh -i ~/.ssh/id_ed25519_pi val@192.168.0.147
```

Tous les fichiers de déploiement sont dans `/opt/edubox/` sur le Pi.

Commande de vérification du statut :
```bash
ssh -i ~/.ssh/id_ed25519_pi val@192.168.0.147 "docker compose -f /opt/edubox/docker-compose.yml ps"
```

---

## Workflow Rules

### Task Tracking
For any task that involves more than 3 files or more than 3 steps:
1. BEFORE starting, create/update a checklist in `docs/tasks/TASKS.md`
2. Mark each sub-step with `[ ]` (todo), `[x]` (done), or `[!]` (blocked)
3. Update the checklist AFTER completing each sub-step
4. If the session is interrupted, the checklist is the source of truth for resuming work

### Resuming Work
When starting a new session or after /clear, ALWAYS:
1. Read `docs/tasks/TASKS.md` to check current progress
2. Identify the first unchecked item
3. Resume from there — do NOT restart completed work

### Documentation Synchronization (OBLIGATOIRE)

**À chaque demande de modification, bug fix ou nouvelle feature — quelle que soit
la façon dont elle est formulée (message direct, fichier temp_*.txt, description
orale) — TOUJOURS :**

1. **Créer ou mettre à jour le fichier de bug** (`docs/bugs/BUG-XXX-*.md`)
   ou de feature (`docs/specs/FEAT-XXX-*.md`) correspondant.

2. **Mettre à jour `docs/specs/specs_keebee.md`** — OBLIGATOIRE, SANS EXCEPTION.
   Ce fichier est la source de vérité de l'application. Il doit refléter à tout
   moment le comportement réel du code. Mettre à jour :
   - La section concernée (UI, architecture, algorithmes, etc.)
   - Le numéro de version en en-tête (FEAT-XXX / BUG-XXX)
   - La structure du projet si des fichiers sont ajoutés/supprimés
   - Les cas limites si un nouveau cas est géré
   Ne pas attendre qu'on le demande. Si la feature est trop petite pour un §
   dédié, intégrer l'info dans la section la plus proche.

3. **Mettre à jour `docs/tasks/TASKS.md`** — toujours, sans condition :
   ajouter l'entrée si elle n'existe pas, cocher `[x]` les étapes terminées.

Cette règle s'applique MÊME pour les petites modifications demandées directement
dans le chat. Si c'est trop petit pour un fichier BUG/FEAT dédié, au minimum
mettre à jour `docs/specs/specs_keebee.md` si le comportement change.

### Règle de confirmation avant commit (OBLIGATOIRE)

**Aucun commit ne doit être créé avant que l'utilisateur ait testé et confirmé.**

Ordre impératif pour tout bug fix ou feature :

```
[code] → [docs] → [déployer sur le Pi] → [demander test] → [attendre OK] → [commit]
```

- Le commit regroupe TOUJOURS : code source + fichiers de doc + TASKS.md
- Si l'utilisateur signale un problème après test → corriger, redéployer,
  re-demander confirmation AVANT de committer
- **Si un crash ou erreur est découvert lors du test** → créer `docs/bugs/BUG-XXX-*.md`
  (même si le problème a déjà été corrigé), mettre à jour `docs/specs/specs_keebee.md`
  avec la règle à retenir, et référencer dans `docs/tasks/TASKS.md`
- Aucune exception : même pour une modification d'une seule ligne

### Bug Fix Workflow
1. Documenter le bug dans `docs/bugs/BUG-XXX-short-name.md` (symptôme,
   reproduction, logs/traceback, section spec impactée)
2. Analyser la cause racine AVANT d'écrire le fix (Plan Mode)
3. Implémenter le fix
4. Mettre à jour toute la documentation :
   - `docs/bugs/BUG-XXX-*.md` → statut `FIXED`, fix appliqué décrit
   - **`docs/specs/specs_keebee.md` → OBLIGATOIRE** : mettre à jour la section du comportement corrigé
   - `docs/tasks/TASKS.md` → cocher `[x]` toutes les étapes terminées
5. **Déployer sur le Pi** : copier les fichiers et relancer les containers concernés
6. **Demander à l'utilisateur de tester et attendre sa confirmation explicite**
   — NE PAS committer avant que l'utilisateur confirme que c'est OK
7. Une fois confirmé : committer TOUS les fichiers modifiés en un seul commit
   (code + docs + TASKS.md) : `"FIX BUG-XXX: description courte"`

### Feature Evolution Workflow
1. Écrire la spec dans `docs/specs/FEAT-XXX-short-name.md` (contexte,
   comportement, spec technique, impact sur l'existant)
2. Analyser l'impact sur le code existant (Plan Mode) : risques, conflits,
   lacunes de la spec
3. Décomposer en tâches dans `docs/tasks/TASKS.md`
4. Implémenter
5. Mettre à jour toute la documentation :
   - `docs/specs/FEAT-XXX-*.md` → statut `DONE`, implémentation décrite
   - **`docs/specs/specs_keebee.md` → OBLIGATOIRE** : intégrer le nouveau comportement dans la/les
     section(s) concernée(s), incrémenter la version
   - `docs/tasks/TASKS.md` → cocher `[x]` toutes les étapes terminées
6. **Déployer sur le Pi** et vérifier
7. **Demander à l'utilisateur de tester et attendre sa confirmation explicite**
   — NE PAS committer avant que l'utilisateur confirme que c'est OK
8. Une fois confirmé : committer TOUS les fichiers modifiés en un seul commit
   (code + docs + TASKS.md) : `"FEAT-XXX: description courte"`
9. Mettre à jour CLAUDE.md si des règles d'architecture ont changé

---

## Création de skills personnalisés

Les skills Claude Code de Val suivent ces conventions :

- **Nom** : toujours préfixé `vb-` (ex: `vb-init`, `vb-release`) pour éviter les conflits avec les skills officiels
- **Structure** : un dossier par skill dans `~/.claude/skills/`, contenant un fichier `SKILL.md`
  ```
  ~/.claude/skills/vb-monSkill/SKILL.md   ✅
  ~/.claude/skills/vb-monSkill.md         ❌ (fichier plat non détecté)
  ```
- **Invocation** : `/vb-monSkill`
