---
id: FEAT-009
title: Support multilingue — Moodle, Kolibri, Koha, SLiMS, PMB + URLs portail par langue
status: DONE
date: 2026-03-30
---

## Contexte

Le portail Ofelia avait déjà un sélecteur de langue (FR/EN/ES/PT/IT/DE) qui traduisait
les descriptions des tuiles. Cette feature étend le comportement pour :
1. Lancer Moodle et Kolibri dans la langue sélectionnée
2. Installer les packs de langues Moodle (ES, PT, IT, DE)
3. Activer l'espagnol dans Koha OPAC, SLiMS et PMB

---

## Implémentation

### Moodle — packs de langues

Moodle 4.5 — packs installés dans `/var/www/moodledata/lang/` :
- `es` — Español (téléchargé depuis download.moodle.org/download.php/direct/langpack/4.5/)
- `pt` — Português
- `it` — Italiano
- `de` — Deutsch
- `fr` — Français (déjà présent)

Activation via URL `?lang=XX` (paramètre natif Moodle, commute la langue pour la session).

### Kolibri — Langue

Kolibri 0.18 **ne supporte pas** le changement de langue via URL.
La langue est configurée dans les préférences device (admin) ou utilisateur.
Le portail pointe vers `/kolibri/` quelle que soit la langue sélectionnée.

### Koha OPAC — Espagnol (BUG-009 fix : URL opac-changelanguage.pl)

Templates ES compilés depuis les fichiers `.po` inclus dans le package Koha :
```bash
docker exec edubox-koha koha-translate --install es-ES
```
Préférences système activées :
- `OPACLanguages = en,es-ES`
- `OPACLanguageSelectorLocation = both`

Sélecteur de langue affiché en haut et bas de l'OPAC.
URL de commutation : `/cgi-bin/koha/opac-changelanguage.pl?language=es-ES` (pose le cookie `KohaOpacLanguage=es-ES` puis redirige vers `/`).
Préférence `opaclanguagesdisplay = 1` activée pour afficher le sélecteur dans l'OPAC.

### SLiMS — Espagnol

Locale `es_ES` avec `.mo` compilé déjà présente dans le container.
Commutation via URL : `?select_lang=es_ES` (pose un cookie valide 4h).

### PMB — Commutation langue via URL + cookie

PMB 8.1 ne propose pas nativement de commutation de langue par URL.
`config.inc.php` a été patché pour lire `?lang=XX` et poser un cookie `pmb_lang` :

```php
// Override langue via URL ?lang=XX ou cookie pmb_lang
if (!empty($_GET["lang"])) {
    $_lc = basename($_GET["lang"]);
    if (file_exists(__DIR__ . "/messages/" . $_lc . ".xml")) {
        $lang = $_lc; $helpdir = $lang;
        setcookie("pmb_lang", $lang, 0, "/pmb/");
    }
} elseif (!empty($_COOKIE["pmb_lang"])) { ... }
```

Langues supportées via le portail : `fr_FR`, `en_US`, `es_ES`, `pt_BR`, `it_IT`, `de_DE`.
Tous les fichiers `.xml` correspondants sont présents dans `includes/messages/`.
Le cookie persiste le temps de la session browser (`expires=0`).

---

## Portail — setLang() + URLs dans i18n

Les URLs de destination de chaque app sont stockées directement dans l'objet `i18n`,
sous les clés `href-moodle`, `href-kolibri`, `href-koha`, `href-slims`.

`setLang()` lit ces clés et met à jour les `href` des cartes correspondantes.

| Lang | Moodle | Kolibri | Koha | SLiMS | PMB |
|------|--------|---------|------|-------|-----|
| fr | `?lang=fr` | `/kolibri/` | `language=en` | `en_US` | `lang=fr_FR` |
| en | `?lang=en` | `/kolibri/` | `language=en` | `en_US` | `lang=en_US` |
| es | `?lang=es` | `/kolibri/` | `language=es-ES` | `es_ES` | `lang=es_ES` |
| pt | `?lang=pt` | `/kolibri/` | `language=en` | `pt_BR` | `lang=pt_BR` |
| it | `?lang=it` | `/kolibri/` | `language=en` | `en_US` | `lang=it_IT` |
| de | `?lang=de` | `/kolibri/` | `language=en` | `de_DE` | `lang=de_DE` |

**Notes** :
- Koha : EN+ES uniquement (templates installés). Koha `opac-changelanguage.pl` redirige vers `/biblio/` (nginx `proxy_redirect`).
- SLiMS : EN/ES/PT/DE via `?select_lang=`. IT → EN_US (pas de locale IT).
- Kolibri : `/kolibri/` pour toutes les langues — les URLs `/kolibri/fr-fr/` requièrent une session active préalable.
- PMB : langue par URL `?lang=XX` + cookie `pmb_lang` (patch `config.inc.php`).
