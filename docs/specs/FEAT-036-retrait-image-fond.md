# FEAT-036 — Retrait du changement d'image de fond du portail

**Statut :** FAIT, validé par Val — 2026-08-22
**Demande :** « on va supprimer le changement d'image de fond car je veux
garder celle qu'on a actuellement. »

---

## Ce qui a déclenché la demande

Val a repéré « Parcourir… » non traduit sur ce champ. C'est un texte que le
navigateur dessine lui-même et qu'aucun attribut ne peut changer (voir
FEAT-035) — plutôt que de contourner, Val a préféré retirer la fonctionnalité.

## La fonctionnalité ne marchait pas

Constaté en la retirant : l'envoi écrivait
`portal/assets/background.png`, alors que le portail affiche
`url('/assets/bg.png')`.

**Une image téléversée n'a jamais pu s'afficher.** Elle occupait de l'espace
disque sans jamais servir.

## Retiré

- le champ, son aperçu et son texte d'aide dans l'assistant ;
- l'envoi au moment de l'installation ;
- les 24 entrées de traduction devenues inutiles ;
- l'endpoint `POST /api/upload-background` — qui acceptait 5 Mo en écriture
  sur la carte SD sans servir à rien. Il renvoie désormais 404.

L'image en place, `portal/assets/bg.png` (665 Ko), n'est pas touchée : elle est
servie en 200 comme avant.

## Pour la changer

Copier le fichier voulu sur la Box :

```bash
scp mon-image.png ofelia@<box>:/tmp/
ssh ofelia@<box> 'sudo install -m 644 -o ofelia -g ofelia /tmp/mon-image.png /opt/edubox/portal/assets/bg.png'
```

Aucun redémarrage nécessaire — nginx sert le fichier directement.
