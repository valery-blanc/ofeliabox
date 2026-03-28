# BUG-001 — Koha crash au redémarrage : log dir manquant

**Statut** : FIXED
**Date** : 2026-03-28
**Composant** : `koha/entrypoint.sh`

## Symptôme

Koha crashe à chaque redémarrage après le premier avec l'erreur supervisord :
```
Error: The directory named as part of the path /var/log/koha/edubox/zebra.log
does not exist in section 'program:zebra'
```

## Cause racine

`koha-create` crée `/var/log/koha/edubox/` lors de la première initialisation. Mais l'entrypoint ne lance `koha-create` que si `/etc/koha/sites/edubox/koha-conf.xml` n'existe pas encore (volume persisté). Aux démarrages suivants, `koha-create` est sauté, le répertoire de logs n'est pas créé, et supervisord refuse de démarrer.

Le commentaire dans l'entrypoint original disait `# NOTE: do NOT pre-create /var/log/koha/$INSTANCE — koha-create creates it` — ce conseil était incorrect pour les redémarrages.

## Fix appliqué

Ajout de `"/var/log/koha/$INSTANCE"` dans le bloc `mkdir -p` de l'entrypoint, **avant** le bloc conditionnel `koha-create` :

```bash
mkdir -p \
    "/var/run/koha/$INSTANCE" \
    "/var/lock/koha/$INSTANCE" \
    "/var/log/koha/$INSTANCE" \   # ← ajouté
    "/var/lib/koha/$INSTANCE/biblios" \
    ...
```

**Fichier modifié** : `koha/entrypoint.sh` ligne 58

## Règle à retenir

Pour tout répertoire référencé dans `supervisord.conf`, s'assurer qu'il est créé **inconditionnellement** dans l'entrypoint, pas seulement via `koha-create`. Les volumes Docker persistent la config mais pas `/var/log/`.
