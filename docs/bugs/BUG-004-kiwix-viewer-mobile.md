# BUG-004 — Kiwix viewer : moitié d'écran sur mobile

**Statut** : FIXED
**Date** : 2026-03-28
**Composant** : `nginx/conf.d/edubox.conf`

## Symptôme

Sur mobile (Android/iOS), la page de lecture d'un livre Kiwix (`/wiki/viewer#...`) n'occupe que la moitié haute de l'écran. Sur PC, la page est plus haute que l'écran et il faut scroller.

## Cause racine

Le CSS de Kiwix (`/wiki/skin/kiwix.css`) définit :
```css
#content_iframe {
  height: 40%;
  width: 100%;
}
```
40% de la hauteur du viewport = environ la moitié de l'écran sur mobile. Sur PC, le contenu dépasse cette hauteur donc on scrolle dans l'iframe, mais sur mobile l'iframe est trop petite.

De plus, `100vh` ne fonctionne pas bien sur mobile car les navigateurs mobiles excluent la barre d'adresse du calcul, causant un débordement. La valeur correcte est `100dvh` (dynamic viewport height).

## Fix appliqué

Injection CSS via nginx sub_filter uniquement sur la page `/wiki/viewer` :

```nginx
location = /wiki/viewer {
    proxy_pass http://kiwix/wiki/viewer;
    include /etc/nginx/proxy_params;
    proxy_set_header Accept-Encoding "";
    sub_filter '</head>' '<style>#content_iframe{height:calc(100dvh - 50px)!important;}</style></head>';
    sub_filter_once on;
}
```

`100dvh - 50px` : 100% de la hauteur dynamique du viewport moins la hauteur approximative de la barre de navigation Kiwix.

## Règle à retenir

Sur mobile, utiliser `100dvh` (pas `100vh`) pour les éléments plein écran. `100vh` exclut la barre d'adresse du navigateur mobile, `100dvh` en tient compte dynamiquement.
