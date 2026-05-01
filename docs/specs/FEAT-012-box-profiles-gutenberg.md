# FEAT-012 — Gutenberg ES + Migration SD 512 GB + Profils multi-box

**Statut** : IN PROGRESS  
**Date** : 2026-05-01  
**Auteur** : Val

---

## Contexte

La box Ofelia tourne sur une SD trop petite pour accueillir la bibliothèque Project Gutenberg
complète en espagnol (~1.7 Go). Cette feature ajoute Gutenberg ES dans Kiwix, migre la SD vers
512 Go, et prépare un système de profils pour créer facilement d'autres box (ex : box française
avec Wikipedia FR + Gutenberg FR).

---

## 1. Migration SD 512 GB (procédure manuelle)

### Pré-requis
- PC Windows avec deux lecteurs USB SD
- Outils : Win32DiskImager ou balenaEtcher

### Étapes

```bash
# 1. Arrêt propre du Pi
ssh -i ~/.ssh/id_ed25519_pi val@192.168.0.147
docker compose -f /opt/edubox/docker-compose.yml down
sudo shutdown -h now

# 2. Sur le PC Windows :
#    - Win32DiskImager : Read depuis ancienne SD → image.img
#    - Win32DiskImager : Write image.img → nouvelle SD 512 GB
#    (l'image fait la taille de l'ancienne SD, pas de 512 GB)

# 3. Insérer la nouvelle SD dans le Pi et démarrer

# 4. Expansion du système de fichiers (se connecte au Pi après boot)
sudo raspi-config nonint do_expand_rootfs
sudo reboot

# 5. Vérification après reboot
df -h /
# Résultat attendu : ~490 GB disponibles

# 6. Redémarrer le stack
docker compose -f /opt/edubox/docker-compose.yml up -d
```

---

## 2. Gutenberg ES dans Kiwix

### ZIM téléchargé
- **Fichier** : `gutenberg_es_all_2026-01.zim`
- **Taille** : 1.7 Go
- **URL** : `https://download.kiwix.org/zim/gutenberg/gutenberg_es_all_2026-01.zim`
- **Destination** : `/opt/edubox/kiwix/data/gutenberg_es.zim`

### Déploiement sur le Pi

```bash
# Télécharger le ZIM (connecté au Pi, après migration SD)
cd /opt/edubox/kiwix/data
wget -O gutenberg_es.zim \
  https://download.kiwix.org/zim/gutenberg/gutenberg_es_all_2026-01.zim

# OU utiliser le script make-box.sh :
cd /opt/edubox
sudo bash scripts/make-box.sh --profile ofelia-es

# Déployer les modifications git :
git pull
docker compose restart kiwix
```

### Modifications code
- **`docker-compose.yml`** : `command` kiwix → ajout `gutenberg_es.zim`
- **`portal/index.html`** : nouvelle carte Gutenberg + i18n 6 langues
  - URL : `/wiki/viewer#gutenberg_es/`
  - Statut : piloté par le service kiwix (même dot que Wikipedia/Wikisource)

---

## 3. Système de profils multi-box

### Structure

```
profiles/
├── ofelia-es/profile.env   # Box actuelle (Wikipedia ES, Wikisource ES, Gutenberg ES)
└── fr-box/profile.env      # Box française (Wikipedia FR, Gutenberg FR, Wikisource FR)

scripts/
└── make-box.sh             # Télécharge les ZIM + met à jour docker-compose.yml
```

### Profil `ofelia-es`

| ZIM | Taille | Description |
|---|---|---|
| `wikipedia_es.zim` | 3.4 Go | Wikipedia ES nopic 2026-02 |
| `wikisource_es.zim` | 728 Mo | Wikisource ES nopic 2026-04 |
| `gutenberg_es.zim` | 1.7 Go | Gutenberg ES all 2026-01 |

### Profil `fr-box`

| ZIM | Taille | Description |
|---|---|---|
| `wikipedia_fr.zim` | 1.1 Go | Wikipedia FR mini 2026-02 |
| `wikisource_fr.zim` | 11 Go | Wikisource FR nopic 2025-09 |
| `gutenberg_fr.zim` | 9.8 Go | Gutenberg FR all 2026-01 |

> **Note** : Wikisource FR (11 Go) + Gutenberg FR (9.8 Go) = ~21 Go supplémentaires.
> Commenter `ZIM_WIKISOURCE` dans le profil pour l'omettre.

### Utilisation

```bash
# Voir ce qui sera téléchargé (dry-run)
sudo bash /opt/edubox/scripts/make-box.sh --profile ofelia-es --dry-run

# Appliquer
sudo bash /opt/edubox/scripts/make-box.sh --profile ofelia-es

# Après provisionnement d'une box FR, patcher le portail manuellement :
sed -i 's|viewer#wikipedia_es/[^"]*|viewer#wikipedia_fr/Accueil|g' portal/index.html
sed -i 's|viewer#wikisource_es/[^"]*|viewer#wikisource_fr/Accueil|g' portal/index.html
sed -i 's|viewer#gutenberg_es/[^"]*|viewer#gutenberg_fr/|g' portal/index.html
```

---

## 4. Vérification end-to-end

1. `df -h /` → ~490 GB disponibles après migration SD
2. `http://192.168.50.1/wiki/viewer#gutenberg_es/` → livres Project Gutenberg en espagnol
3. `http://192.168.50.1/` → portail affiche carte Gutenberg (vert, icône 📚)
4. Indicateur de statut Gutenberg = vert quand kiwix est up
5. `sudo bash scripts/make-box.sh --profile fr-box --dry-run` → liste les ZIM FR
