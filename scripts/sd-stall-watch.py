#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ofelia Box — mesure la DURÉE des blocages de la carte SD.

Le noyau signale qu'une carte cale (« Card stuck being busy ») mais ne dit
jamais quand elle repart : impossible d'en tirer une durée. On l'observe donc
directement dans /proc/diskstats.

Un blocage a une signature nette : des requêtes sont **en vol** alors qu'**aucune
ne se termine**. En marche normale, même sous forte charge, les compteurs de
lectures et d'écritures terminées avancent en permanence ; quand la carte se tait,
ils se figent alors que le compteur de requêtes en attente reste positif.

Ce programme échantillonne chaque seconde, et n'écrit sur le disque **qu'à la fin
d'un blocage** — surveiller le stockage en le sollicitant serait absurde.

Champs de /proc/diskstats utilisés (après major/minor/nom) :
    [3]  lectures terminées      [7]  écritures terminées
    [11] requêtes en vol         [12] ms passées en E/S
"""
import os
import sys
import time

PERIPHERIQUE = "mmcblk0"
JOURNAL = "/var/log/ofelia-sd-blocages.log"
PERIODE = 1.0
# En dessous de ce seuil, on est dans le bruit : une carte peut ne rien terminer
# pendant une seconde ou deux sans que ce soit un incident.
SEUIL_S = 3


def statistiques():
    """Lectures terminées, écritures terminées, requêtes en vol."""
    try:
        with open("/proc/diskstats") as fh:
            for ligne in fh:
                champs = ligne.split()
                if len(champs) > 12 and champs[2] == PERIPHERIQUE:
                    return int(champs[3]), int(champs[7]), int(champs[11])
    except OSError:
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
    # Repris par journald, donc consultable avec journalctl -u ofelia-sd-stall-watch
    sys.stdout.write("blocage de %.0f s termine (debut %s, %s C)\n"
                     % (duree, horodatage, temp))
    sys.stdout.flush()


def main():
    precedent = statistiques()
    if precedent is None:
        sys.stderr.write("peripherique %s introuvable dans /proc/diskstats\n" % PERIPHERIQUE)
        return 1

    # Definition retenue, explicite parce qu'elle change le chiffre affiche :
    #   duree = instant de reprise - dernier instant ou des requetes aboutissaient.
    # Dater le blocage au premier echantillon fige le raccourcirait d'une periode
    # d'echantillonnage, le temps de constater qu'il dure.
    dernier_ok = time.time()
    temp_debut = None
    bloque_vu = False

    while True:
        time.sleep(PERIODE)
        actuel = statistiques()
        if actuel is None:
            continue
        maintenant = time.time()

        avance = (actuel[0] != precedent[0]) or (actuel[1] != precedent[1])
        en_vol = actuel[2] > 0

        if en_vol and not avance:
            # Des requetes attendent, aucune n'aboutit.
            bloque_vu = True
            if temp_debut is None:
                temp_debut = temperature()
        else:
            duree = maintenant - dernier_ok
            # `bloque_vu` evite de compter comme blocage disque une simple
            # famine de processeur qui aurait retarde notre propre reveil.
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
