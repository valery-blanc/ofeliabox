# -*- coding: utf-8 -*-
"""Verifie le detecteur de blocages en lui injectant des situations fabriquees.

On importe le VRAI script et on remplace ses entrees (lecture de
/proc/diskstats, horloge, sommeil) : c'est le code livre qui est teste, pas une
copie du raisonnement.
"""
import importlib.util
import sys

spec = importlib.util.spec_from_file_location(
    "veille", "/opt/edubox/scripts/sd-stall-watch.py")
veille = importlib.util.module_from_spec(spec)
spec.loader.exec_module(veille)

echecs = []


def scenario(nom, echantillons, attendu):
    """echantillons : liste de (lectures, ecritures, en_vol), une par seconde."""
    horloge = {"t": 1000.0}
    releves = list(echantillons)
    notes = []

    def faux_stats():
        if not releves:
            raise SystemExit  # fin du scenario
        return releves.pop(0)

    def faux_sleep(_):
        horloge["t"] += 1.0

    veille.statistiques = faux_stats
    veille.temperature = lambda: 40.0
    veille.note = lambda debut, duree, temp: notes.append(round(duree))
    veille.time.sleep = faux_sleep
    veille.time.time = lambda: horloge["t"]

    try:
        veille.main()
    except SystemExit:
        pass

    if notes == attendu:
        print("  OK   %-46s -> %s" % (nom, notes))
    else:
        print("  ECHEC %-45s -> %s (attendu %s)" % (nom, notes, attendu))
        echecs.append(nom)


# Charge normale : les compteurs avancent, rien a signaler meme en vol.
scenario("charge soutenue, aucune requete bloquee",
         [(i, i, 4) for i in range(1, 20)],
         [])

# Requetes en vol mais aucune terminaison : blocage de 10 s.
gele = [(10, 10, 3)] * 10
scenario("blocage franc de 10 s",
         [(1, 1, 2), (2, 2, 2)] + gele + [(11, 11, 2), (12, 12, 2)],
         [10])

# Sous le seuil : deux secondes sans terminaison, c'est du bruit.
scenario("micro-pause de 2 s (sous le seuil)",
         [(1, 1, 2), (2, 2, 2), (3, 3, 1), (3, 3, 1), (4, 4, 2), (5, 5, 2)],
         [])

# Disque au repos : rien en vol, donc rien a signaler, meme fige longtemps.
scenario("disque au repos, aucune requete en vol",
         [(7, 7, 0)] * 15,
         [])

# Deux blocages successifs, mesures separement.
scenario("deux blocages de 5 s et 6 s",
         [(1, 1, 2)] + [(2, 2, 3)] * 5 + [(3, 3, 2)]
         + [(4, 4, 3)] * 6 + [(5, 5, 2), (6, 6, 2)],
         [5, 6])

print()
if echecs:
    print("%d scenario(s) en echec : %s" % (len(echecs), ", ".join(echecs)))
    sys.exit(1)
print("les 5 scenarios passent")
