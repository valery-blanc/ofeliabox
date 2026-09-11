# BUG-040 — BibliOfelia ne démarre pas : les scripts partent de Windows en CRLF

**Statut :** CORRIGÉ sur la Box — correctif pérenne à valider par Val
**Constaté :** 2026-08-26, en remontant la Box sur une carte neuve.

---

## Le symptôme

Le conteneur `edubox-bibliofelia` redémarre en boucle, code de sortie **127** :

```
[FATAL tini (7)] exec /app/scripts/entrypoint.sh failed: No such file or directory
```

Le message est trompeur : le fichier **existe** dans l'image, et il est
exécutable.

```
-rwxrwxr-x 1 root root 699 Aug 23 20:30 entrypoint.sh
```

## La cause

« No such file or directory » ne désigne pas le script, mais **l'interpréteur de
son shebang**. Première ligne du fichier, octet par octet :

```
0000000   #   !   /   b   i   n   /   s   h  \r  \n
```

Le `\r` fait partie du nom : le noyau cherche un exécutable appelé `/bin/sh\r`,
qui n'existe évidemment pas.

Les sources ont été transférées depuis le poste Windows avec `git archive`. Or
`core.autocrlf = true` y est actif et **aucun `.gitattributes` ne protège les
scripts shell** :

```
$ git config core.autocrlf
true
$ git check-attr text eol -- scripts/entrypoint.sh
scripts/entrypoint.sh: text: unspecified
scripts/entrypoint.sh: eol: unspecified
```

`git archive` applique les filtres de conversion : l'archive contenait donc des
fins de ligne CRLF. **680 fichiers** étaient concernés, dont 5 scripts à
shebang — les seuls réellement bloquants (Python, lui, tolère les CRLF).

Ce défaut ne s'était jamais manifesté parce que la Box avait toujours été
déployée par copie depuis un environnement qui préservait les fins de ligne.
Il n'apparaît qu'au premier transfert via `git archive` depuis Windows —
c'est-à-dire exactement le jour où l'on remonte une Box après un sinistre.

## Le correctif appliqué sur la Box

Conversion de tous les fichiers texte, puis reconstruction de l'image :

```bash
grep -rlI $'\r' . | xargs sed -i 's/\r$//'
docker compose build bibliofelia
```

Vérifié : 0 fichier en CRLF, shebang en `\n`, conteneur **healthy**, gunicorn à
l'écoute, 953 exemplaires / 22 membres / 3 prêts visibles par l'application.

## Le correctif pérenne — à faire dans le dépôt BibliOfelia

Sans cela, le problème reviendra au prochain transfert depuis Windows. Ajouter
un `.gitattributes` à la racine de `C:\WORK\BibliOfelia` :

```gitattributes
# Les scripts exécutés sous Linux doivent garder des fins de ligne LF, quel
# que soit le poste qui les commite. Un CRLF dans un shebang rend le script
# introuvable pour le noyau (BUG-040).
*.sh    text eol=lf
*.py    text eol=lf
Dockerfile*  text eol=lf
*.yml   text eol=lf
*.yaml  text eol=lf
entrypoint* text eol=lf
```

⚠️ Ce fichier appartient au dépôt **BibliOfelia**, pas à `ofeliabox` : il doit
être committé là-bas, ce qui demande la validation de Val.

⚠️ Après ajout, les fichiers déjà indexés en CRLF doivent être renormalisés une
fois : `git add --renormalize .` puis un commit.

## Vérification suggérée avant tout déploiement

Une ligne qui attrape le défaut avant qu'il ne coûte une heure :

```bash
grep -rlI $'\r' --include='*.sh' . && echo "CRLF DETECTE — corriger avant build"
```
