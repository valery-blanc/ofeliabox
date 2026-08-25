# -*- coding: utf-8 -*-
"""Verifie le detecteur de blocages, sur donnees FABRIQUEES et donnees REELLES.

Le premier detecteur passait tous ses tests synthetiques et ne detectait
pourtant rien sur la Box : les scenarios lui fournissaient un champ « requetes
en vol » positif, alors qu'il vaut presque toujours 0 dans la vraie vie. Les
tests validaient le raisonnement, pas la premisse.

D'ou le rejeu sur une trace reelle capturee sur la Box : c'est le seul moyen de
verifier qu'on ne crie pas au loup sur du trafic normal.
"""
import importlib.util
import sys

CHEMIN = "/opt/edubox/scripts/sd-stall-watch.py"
TRACE = "/tmp/trace-reelle.txt"

spec = importlib.util.spec_from_file_location("veille", CHEMIN)
veille = importlib.util.module_from_spec(spec)
spec.loader.exec_module(veille)

echecs = []


def rejoue(nom, echantillons, attendu, exact=True):
    """echantillons : (lectures, ecritures, io_ticks), un par seconde.

    Rappel de la definition mesuree : duree = reprise - dernier instant
    productif. N echantillons figes entre les deux valent donc N+1 secondes.
    Les premiers attendus ecrits ici ignoraient ce +1 et accusaient le
    detecteur a tort.
    """
    horloge = {"t": 1000.0}
    restants = list(echantillons)
    notes = []

    def faux_stats():
        if not restants:
            raise SystemExit
        return restants.pop(0)

    veille.statistiques = faux_stats
    veille.temperature = lambda: 40.0
    veille.note = lambda debut, duree, temp: notes.append(round(duree))
    veille.time.sleep = lambda _: horloge.__setitem__("t", horloge["t"] + 1.0)
    veille.time.time = lambda: horloge["t"]

    try:
        veille.main()
    except SystemExit:
        pass

    ok = (notes == attendu) if exact else (len(notes) == attendu)
    montre = notes if exact else len(notes)
    if ok:
        print("  OK    %-44s -> %s" % (nom, montre))
    else:
        print("  ECHEC %-44s -> %s (attendu %s)" % (nom, montre, attendu))
        echecs.append(nom)


print("=== donnees fabriquees ===")

# Charge normale : le disque travaille ET termine des requetes.
rejoue("charge soutenue, requetes qui aboutissent",
       [(i, i, i * 100) for i in range(1, 20)], [])

# Disque occupe (io_ticks avance) mais plus rien ne se termine : blocage.
# 10 echantillons figes -> 11 s entre le dernier instant productif et la reprise.
bloque = [(10, 10, 5000 + i * 100) for i in range(1, 11)]
rejoue("blocage : 10 echantillons figes -> 11 s",
       [(9, 9, 4800), (10, 10, 4900)] + bloque + [(11, 11, 6100), (12, 12, 6200)],
       [11])

# Un seul echantillon fige -> 2 s, sous le seuil de 3 s : c'est du bruit.
rejoue("micro-pause de 2 s (sous le seuil)",
       [(1, 1, 100), (2, 2, 200), (2, 2, 300), (3, 3, 400), (4, 4, 500)], [])

# Deux echantillons figes -> 3 s, pile au seuil : doit etre signale.
rejoue("blocage de 3 s (pile au seuil)",
       [(1, 1, 100), (2, 2, 200), (2, 2, 300), (2, 2, 400), (3, 3, 500)], [3])

# Disque au repos : io_ticks fige, donc pas occupe, donc pas de blocage.
rejoue("disque au repos (io_ticks fige)", [(7, 7, 900)] * 15, [])

# Deux blocages successifs, mesures separement.
# 5 puis 6 echantillons figes -> 5 s et 7 s (le second est precede d'un
# echantillon productif de moins).
s1 = [(2, 2, 1000 + i * 50) for i in range(1, 6)]
s2 = [(3, 3, 2000 + i * 50) for i in range(1, 7)]
rejoue("deux blocages successifs, mesures separement",
       [(1, 1, 900)] + s1 + [(3, 3, 1500)] + s2 + [(4, 4, 2500), (5, 5, 2600)],
       [5, 7])

print()
print("=== trace REELLE capturee sur la Box (sous charge) ===")
try:
    lignes = [l.split() for l in open(TRACE) if not l.startswith("#")]
    reels = [(int(a), int(b), int(c)) for a, b, c in lignes if len([a, b, c]) == 3]
    print("  %d echantillons rejoues" % len(reels))
    rejoue("aucun faux positif sur trafic reel", reels, 0, exact=False)
except OSError:
    print("  trace introuvable :", TRACE)
    echecs.append("trace reelle")

print()
if echecs:
    print("%d scenario(s) en echec : %s" % (len(echecs), ", ".join(echecs)))
    sys.exit(1)
print("tous les scenarios passent")
