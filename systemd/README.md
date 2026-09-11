# Unités systemd de la Ofelia Box

Ces fichiers vivent sur l'hôte, dans `/etc/systemd/system/`. Ils y sont
**copiés** à l'installation : ce dossier en est la copie versionnée, sans
laquelle une réinstallation repartirait sans démarrage ordonné ni sauvegarde
automatique — deux choses dont l'absence ne se remarque pas tout de suite.

| Unité | Rôle |
|---|---|
| `ofelia-boot.service` | démarrage ordonné des applications (FEAT-033) |
| `ofelia-backup.service` + `.timer` | sauvegarde nocturne sur clé USB (FEAT-030) |
| `ofelia-firewall.service` | règles de pare-feu |
| `ofelia-wifi.service` | point d'accès Wi-Fi |

Installation :

```bash
sudo install -m 644 systemd/*.service systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ofelia-boot.service ofelia-backup.timer
```

`scripts/RESTAURER-OFELIA.sh` le fait automatiquement.
