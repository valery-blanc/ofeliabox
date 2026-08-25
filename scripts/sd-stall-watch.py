#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ofelia Box — mesure la DURÉE des blocages de la carte SD.

Le noyau signale qu'une carte cale (« Card stuck being busy ») mais ne dit
jamais quand elle repart : la durée ne peut venir que de l'observation directe.

SIGNATURE RETENUE : le disque est **occupé** alors que **rien ne se termine**.

    io_ticks avance  ET  (lectures terminées + écritures terminées) figées

⚠️ Une première version utilisait « requêtes en vol » (champ 12) comme preuve
d'activité. C'était faux : ce champ est un instantané, et à un échantillon par
seconde il vaut presque toujours 0 même en pleine charge — le détecteur n'a
donc jamais rien détecté, y compris pendant cinq calages réels. `io_ticks`
(champ 13) est cumulatif : c'est le temps total passé par le disque à
travailler, il ne peut pas être manqué entre deux échantillons.

Ce programme n'écrit sur le disque qu'à la **fin** d'un blocage : surveiller le
stockage en le sollicitant serait absurde.

Champs de /proc/diskstats, numérotés comme dans la documentation du noyau :
    4  lectures terminées      8  écritures terminées
    12 requêtes en vol         13 temps passé à travailler (ms)
"""
import os
import sys
import time

PERIPHERIQUE = "mmcblk0"
JOURNAL = "/var/log/ofelia-sd-blocages.log"
PERIODE = 1.0
# En dessous de ce seuil on est dans le bruit : un disque peut ne rien terminer
# pendant une seconde ou deux sans que ce soit un incident.
SEUIL_S = 3.0


def statistiques():
    """(lectures terminées, écritures terminées, io_ticks) ou None."""
    try:
        with open("/proc/diskstats") as fh:
            for ligne in fh:
                champs = ligne.split()
                if len(champs) > 12 and champs[2] == PERIPHERIQUE:
                    return int(champs[3]), int(champs[7]), int(champs[12])
    except (OSError, ValueError):
        pass
    return None


def temperature():
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as fh:
            return round(int(fh.read().strip()) / 1000.0, 1)
    except (OSError, ValueError):
        return None


def note(debut, duree, temp):
    """Une ligne par blocage. Écrit seulement à la fin — jamais pendant."""
    horodatage = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(debut))
    ligne = "%s\tduree=%.0f\ttemp=%s\n" % (horodatage, duree,
                                           temp if temp is not None else "?")
    try:
        with open(JOURNAL, "a") as fh:
            fh.write(ligne)
    except OSError as e:
        sys.stderr.write("impossible d'ecrire %s : %s\n" % (JOURNAL, e))
    # Repris par journald : journalctl -u ofelia-sd-stall-watch
    sys.stdout.write("blocage de %.0f s termine (debut %s, %s C)\n"
                     % (duree, horodatage, temp))
    sys.stdout.flush()


def main():
    precedent = statistiques()
    if precedent is None:
        sys.stderr.write("peripherique %s introuvable dans /proc/diskstats\n"
                         % PERIPHERIQUE)
        return 1

    # Définition retenue, explicite parce qu'elle change le chiffre affiché :
    #   durée = instant de reprise − dernier instant où des requêtes aboutissaient.
    # Dater le blocage au premier échantillon figé le raccourcirait d'une
    # période, le temps de constater qu'il dure.
    dernier_ok = time.time()
    temp_debut = None
    bloque_vu = False

    while True:
        time.sleep(PERIODE)
        actuel = statistiques()
        if actuel is None:
            continue
        maintenant = time.time()

        termine = (actuel[0] != precedent[0]) or (actuel[1] != precedent[1])
        occupe = actuel[2] != precedent[2]

        if occupe and not termine:
            # Le disque travaille, mais aucune requête n'aboutit.
            bloque_vu = True
            if temp_debut is None:
                temp_debut = temperature()
        else:
            duree = maintenant - dernier_ok
            # `bloque_vu` évite de compter comme blocage disque une famine de
            # processeur qui aurait retardé notre propre réveil.
            if bloque_vu and duree >= SEUIL_S:
                note(dernier_ok, duree, temp_debut)
            dernier_ok = maintenant
            temp_debut = None
            bloque_vu = False

        precedent = actuel


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
