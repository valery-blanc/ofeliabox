# BUG-003 — Kiwix : CSS/JS cassés avec sub_filter nginx

**Statut** : FIXED
**Date** : 2026-03-28
**Composant** : `nginx/conf.d/edubox.conf`, `docker-compose.yml`

## Symptôme

Après déploiement de Kiwix derrière nginx à `/wiki/`, la page s'affiche sans CSS, sans images, et avec une erreur JS :
```
Le chargement du module à l'adresse « http://192.168.0.147/skin/i18n.js?cacheid=... »
a été bloqué en raison d'un type MIME interdit (« text/html »).
```
La recherche ne retournait aucun résultat. Les redirects de Kiwix (ex: `/content/wikipedia_es/Colombia`) cassaient car le header `Location:` ne contenait pas le préfixe `/wiki/`.

## Cause racine

Deux problèmes distincts :

1. **sub_filter HTML uniquement** : `sub_filter_types text/html` réécrit `href="/"` → `href="/wiki/"` dans le HTML, mais les fichiers JS de Kiwix contiennent eux-mêmes des chemins absolus `/skin/...` qui ne sont pas réécrits. Le JS demande `/skin/i18n.js` directement (sans `/wiki/`), nginx ne trouve pas la route, retourne une page HTML 404 avec le mauvais MIME type.

2. **Redirects sans préfixe** : Kiwix génère des `Location: /content/wikipedia_es/Colombia` (sans `/wiki/`). Sans `proxy_redirect`, le navigateur suit ce redirect vers `http://192.168.50.1/content/...` qui n'existe pas dans nginx.

## Fix appliqué

Utiliser le flag natif `--urlRootLocation=/wiki` de kiwix-serve : Kiwix génère **toutes** ses URLs avec le préfixe `/wiki` directement, sans besoin de réécriture nginx.

Config nginx simplifiée :
```nginx
location /wiki/ {
    proxy_pass http://kiwix/wiki/;  # proxy vers /wiki/ sur Kiwix
    include /etc/nginx/proxy_params;
    # plus de sub_filter, plus de proxy_redirect
}
```

## Règle à retenir

Pour proxifier Kiwix sous un préfixe, toujours utiliser `--urlRootLocation=/<prefix>` dans la commande kiwix-serve. Ne pas utiliser sub_filter nginx pour réécrire les URLs Kiwix — les fichiers JS internes contiennent des chemins absolus impossibles à réécrire côté serveur.
