# BUG-019 — Koha : page maintenance.pl en boucle (mauvais format Version)

**Statut** : FIXED  
**Découvert** : 2026-05-02  
**Feature liée** : FEAT-016

## Symptôme

Après auto-installation du schéma Koha, toutes les requêtes HTTP redirigent vers
`/cgi-bin/koha/maintenance.pl` qui retourne 404 (URL sans préfixe `/biblio/`).

## Cause racine

`C4/Auth.pm` transforme la version avant comparaison :
```perl
$kohaversion =~ s/(.*\..*)\.(.*)\.(.*)/$1$2$3/;
# "25.11.04.000" → "25.1104000"
```
Puis compare numériquement :
```perl
if ( C4::Context->preference('Version') < $kohaversion ) {
    return ( "maintenance", ... );
}
```

On stockait `25.11.04.000` dans `systempreferences.Version`.  
En Perl numérique : `"25.11.04.000"` = `25.11` < `"25.1104000"` = `25.1104` → **maintenance en boucle**.

## Fix appliqué

`koha/entrypoint.sh` : appliquer la même regex avant d'insérer en base.

```bash
KOHA_VER=$(PERL5LIB=/usr/share/koha/lib KOHA_CONF="$KOHA_CONF" \
    perl -e 'use Koha; my $v=Koha::version(); $v=~s/(.*\..*)\.(.*)\.(.*)/$1$2$3/; print $v;')
# stocke "25.1104000" au lieu de "25.11.04.000"
```

## Problèmes additionnels découverts

- **PMB OPAC 500** : `opac_css/includes/opac_db_param.inc.php` absent.  
  Fix : l'entrypoint PMB le génère maintenant (comme `db_param.inc.php`).

- **PMB hash password** : `MariaDB PASSWORD()` ≠ PHP `sha1(hex2bin(sha1()))`.  
  Résultat : les hashes sont en fait identiques (fausse alarme — le test SSH  
  avait des variables locales non définies). Hash MariaDB = hash PMB pour ce format.

- **credentials-data.json absent** : fichier créé manuellement via Python  
  à partir du `.env` ; sera recréé par le wizard lors du prochain install.
