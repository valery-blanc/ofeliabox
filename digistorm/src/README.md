# Digistorm

Digistorm est une application en ligne pour créer des sondages, des questionnaires, des remue-méninges et des nuages de mots collaboratifs.

Pour l'affichage des nuages de mots, Digistorm utilise Vue Wordcloud (https://github.com/SeregPie/VueWordCloud), publié sous licence MIT.

Elle est publiée sous licence GNU AGPLv3.
Sauf les fontes Roboto Slab et Material Icons (Apache License Version 2.0) et la fonte Mona Sans Expanded (Sil Open Font Licence 1.1)

## Prérequis
Node.js 22+, Redis 7+

## Préparation et installation des dépendances
```
npm install
```

## Lancement du serveur de développement sur localhost:3000
```
npm run dev
```

## Variables d'environnement (fichier .env à créer à la racine du dossier)
```
DOMAIN (protocole + domaine. ex : https://digistorm.app / seulement utilisée en production)
PORT (port du serveur local / 3000 par défaut)
REVERSE_PROXY (utilisation d'un reverse proxy qui permet de servir les fichiers à la place d'Express (Nginx par exemple) / 0 ou 1 / 0 par défaut)
NODE_CLUSTER (utilisation de node.js en cluster / 0 ou 1 / 0 par défaut)
EARLY_HINTS (utilisation par le serveur des early hints et du code de statut 103 / 0 ou 1 / 0 par défaut)
DB_HOST (IP publique du serveur de base de données Redis)
DB_PWD (mot de passe de la base de données Redis)
DB_PORT (port de la base de données Redis / 6379 par défaut)
SESSION_KEY (clé de session Express Session)
SESSION_DURATION (durée de la session de connexion des utilisateurs en millisecondes)
COOKIE_SECURE (cookie de session en Secure + SameSite=None en production / 0 ou 1 / 1 par défaut / mettre à 0 uniquement pour tester en HTTP local avec Docker)
EMAIL_HOST (hôte pour l'envoi d'e-mails)
EMAIL_ADDRESS (adresse pour l'envoi d'e-mails)
EMAIL_PASSWORD (mot de passe de l'adresse e-mail)
EMAIL_PORT (port pour l'envoi d'e-mails)
EMAIL_SECURE (1 ou 0)
AUTHORIZED_DOMAINS (domaines autorisés pour api serveur. ex : ladigitale.dev,example.com / * par défaut)
ADMIN_PASSWORD (mot de passe pour accès page /admin)
VITE_UPLOAD_LIMIT (taille maximale de téléversement des fichiers en Mo / 5 par défaut)
VITE_DEFAULT_LANGUAGE (de, en, es, fr ou it / fr par défaut)
VITE_STORAGE (type de stockage pour les fichiers - fs ou s3 / fs - filestorage par défaut)
VITE_S3_PUBLIC_LINK (lien public vers les contenus du conteneur d'objets S3)
S3_SERVER_TYPE (aws ou minio / aws par défaut)
S3_ENDPOINT (endpoint S3)
S3_ACCESS_KEY (clé d'accès S3)
S3_SECRET_KEY (clé secrète d'accès S3)
S3_REGION (région du conteneur S3)
S3_BUCKET (nom du conteneur s3)
S3_MAX_SOCKETS (nombre maximum de sockets pour httpsAgent du client S3)
ENCRYPTION_KEY (clé pour decrypter les données Digidrive / uniquement nécessaire si Digidrive est utilisé)
VITE_LEGAL_TERMS_LINK (lien vers les mentions légales)
ACCOUNT_VALIDATION (validation de l'inscription par email / 0 ou 1 / 0 par défaut)
UMAMI_SCRIPT_URL (lien vers le script fourni par Umami pour l'analyse de trafic)
UMAMI_WEBSITE_ID (id de site sur le serveur Umami)
```

## Compilation et minification des fichiers pour la production
```
npm run build
```

## Avec PM2
```
pm2 start ecosystem.config.cjs --env production
```

## Avec Docker

Le dépôt fournit un `Dockerfile` (build multi-étapes : compilation Vite/Vike puis image de production) ainsi que deux fichiers `docker-compose` : `docker-compose.yml` (Traefik + app + Redis) et `docker-compose.override.yml`, chargé automatiquement en complément pour adapter la configuration à un test en local.

Dans les deux cas, un fichier `.env` doit être créé à la racine du dossier avec au minimum les variables `DB_PWD` et `SESSION_KEY` pour un test en local et `DOMAIN`, `DB_PWD`, `SESSION_KEY` et `ACME_EMAIL` (adresse e-mail utilisée pour la génération des certificats Let's Encrypt) pour un déploiement en production.

### Test local

```
docker compose up --build
```

L'override désactive Traefik, expose directement l'application sur `http://localhost:3000` et force `COOKIE_SECURE=0` pour permettre de tester la connexion à un compte en HTTP local.

### Production

En production, Traefik gère les certificats HTTPS (Let's Encrypt) et dirige les requêtes vers l'application.

Lancer le déploiement avec le profil Traefik activé :
```
./docker-production.sh
```

Les fichiers utilisateurs (`static/fichiers`) et les données Redis persistent entre les redéploiements.

Les variables `VITE_*` utilisées côté client sont injectées au moment de la construction de l'image : toute modification de ces variables dans `.env` nécessite de reconstruire l'image pour être prise en compte.

## Démo
https://digistorm.app

## Comment contribuer ?
Pour signaler des bugs, proposer des améliorations ou de nouvelles fonctionnalités, vous pouvez ouvrir un ticket sur ce dépôt, publier un message sur [ce mur](https://digipad.app/p/8/64dab892e6eab) ou m'envoyer un e-mail.

Les demandes d'ajouts (Pull Requests) ne sont pas acceptées pour le moment. En effet, une contribution au code nécessite souvent plusieurs heures pour être révisée et commentée et ce n'est pas toujours compatible avec les priorités et le temps que je peux consacrer au projet.

Il est possible de soutenir financièrement le projet via [Liberapay](https://liberapay.com/ladigitale/), [Open Collective](https://opencollective.com/ladigitale) ou [Stripe](https://donate.stripe.com/4gweWveqf2sc6KAcMO).

Vous trouverez d'autres idées de contribution sur [cette page](https://ladigitale.dev/contribuer.html).

Merci pour votre soutien ! N'hésitez pas à me contacter si vous avez des questions.

## Remerciements et crédits
Traduction en espagnol par [Fernando S. Delgado Trujillo](https://gitlab.com/fersdt)

Traduction en italien par [Paolo Mauri](https://gitlab.com/maupao) et @nilocram (Roberto Marcolin)
