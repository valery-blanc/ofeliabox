# FEAT-032 — Digistorm en accès local, et fin annoncée du domaine public

**Statut :** FAIT — 2026-08-21
**Décisions de Val :** Digistorm local uniquement ; le domaine public n'est pas maintenu après le départ de la Box.

---

## 1. Le montage réseau, à connaître avant tout

`canaima.bibliofelia.org` **ne désigne pas la Box**. Il désigne l'IP publique
du domicile (`31.164.198.65`), où **Traefik** (sur Fez, `192.168.0.221`) prend
le relais :

```
navigateur ──https──> Traefik (Fez) ──http──> nginx Box :80
```

La route est déclarée sur Fez dans
`~/docker/traefik/dynamic/canaima.bibliofelia.org.yml` :

```yaml
services:
  canaima-bibliofelia-org-svc:
    loadBalancer:
      servers:
        - url: "http://192.168.0.147:80"
```

**Traefik ne route que 80 et 443.** Tout service exposé sur un autre port de la
Box est donc invisible depuis le domaine public.

## 2. Pourquoi Digistorm ne pouvait pas fonctionner à distance

Digistorm est servi sur le **port 3000**, et ses ressources sont en chemins
**absolus** :

```html
<link href="/assets/static/destyle.DvL93Z-0.css">
<script src="/js/qrcode.js">
```

Il ne peut donc pas vivre sous un sous-chemin `/digistorm/` : toutes ses
ressources pointeraient à la racine du portail. C'est ce que constatait déjà le
commentaire de `edubox.conf` (« pas de sous-chemin possible »).

Restaient deux voies pour l'exposer — un sous-domaine dédié avec sa route
Traefik, ou un point d'entrée Traefik sur le port 3000 avec redirection de port
sur la box internet. **Val a choisi ni l'un ni l'autre :** sur place, les
usagers sont sur le réseau de la bibliothèque, où `http://ofelia.box:3000/`
fonctionne parfaitement.

## 3. Ce qui a été corrigé

La tuile fabriquait `http://${location.hostname}:3000/`. Correct en accès
direct — réseau local, `ofelia.box`, point d'accès Wi-Fi, ZeroTier — mais
**mort** derrière le domaine public, où le port 3000 n'est pas routé (et où un
lien `http://` depuis une page `https` serait de toute façon bloqué).

La distinction se fait **côté nginx**, seul endroit qui la connaisse de façon
sûre : un proxy amont est présent si et seulement si la requête porte un
en-tête `X-Forwarded-Proto`. Aucune heuristique sur le nom d'hôte.

```nginx
map $http_x_forwarded_proto $via_upstream_proxy {
    default  "true";
    ""       "false";
}
```

```nginx
location = / {
    sub_filter 'OFELIA_VIA_PROXY = false' 'OFELIA_VIA_PROXY = $via_upstream_proxy';
    sub_filter_once on;
}
```

Quand la valeur passe à `true`, `hrefFn` renvoie `null`, et la tuile devient
**visible mais inerte**, avec la mention « sur le réseau de la bibliothèque »
traduite dans les six langues du portail.

Une tuile qui disparaît fait chercher ; une tuile qui ne mène nulle part fait
douter de la Box. Une tuile grisée qui dit pourquoi ne fait ni l'un ni l'autre.

`setStatus()` a été ajusté en conséquence : la sonde d'état périodique
ignore les tuiles inertes, sinon elle écrasait ce libellé par « en ligne » ou
« hors ligne » toutes les 30 secondes.

### Vérification

Code réellement servi, évalué dans les deux modes :

| Proxy amont | `href` Digistorm | `href` Calibre (témoin) |
|---|---|---|
| absent | `http://ofelia.box:3000/` | `/calibre/` |
| présent | `null` → tuile inerte | `/calibre/` |

Drapeau injecté par nginx : `false` en accès direct, `true` via le domaine
public — vérifié sur l'URL réelle. Syntaxe JavaScript de la page validée.

---

## 4. ⚠️ Le domaine public s'éteindra au départ de la Box

La route Traefik pointe sur **`192.168.0.147`, une adresse du réseau local du
domicile**. Le jour où la Box est à Canaima, Fez ne peut plus l'atteindre :
`canaima.bibliofelia.org` cesse de fonctionner **entièrement** — pas seulement
Digistorm.

ZeroTier aurait pu servir de chemin de secours (la Box y est en ligne,
`10.115.169.147`), mais **Fez est en `ACCESS_DENIED`** : son nœud
`8d6e01b097` n'est pas autorisé sur le réseau ZeroTier.

**Val a décidé de ne pas maintenir le domaine.** Ce n'est donc pas un incident
à venir mais un choix assumé, consigné ici pour qu'il ne soit pas rediagnostiqué
comme une panne dans six mois.

### Accès à distance retenu

Directement par ZeroTier, depuis une machine autorisée sur le réseau :

| Usage | Adresse |
|---|---|
| Portail principal | `http://10.115.169.147/` |
| Portail d'administration | `http://10.115.169.147:8080/` |
| SSH | `ssh -i ~/.ssh/id_ed25519_pi ofelia@10.115.169.147` |
| Digistorm | `http://10.115.169.147:3000/` |

Digistorm **fonctionne** par ce chemin : c'est un accès direct à la Box, sans
proxy — la tuile reste donc cliquable, et c'est bien le comportement voulu.

### Si le domaine doit être rétabli plus tard

1. Autoriser le nœud `8d6e01b097` (Fez) dans ZeroTier Central.
2. Sur Fez, remplacer dans `~/docker/traefik/dynamic/canaima.bibliofelia.org.yml`
   `http://192.168.0.147:80` par `http://10.115.169.147:80`.
3. Recharger Traefik (provider `file` : rechargement automatique).

À faire aussi sur **Avignon**, nœud de secours du failover, faute de quoi une
bascule ramènerait l'ancienne route.
