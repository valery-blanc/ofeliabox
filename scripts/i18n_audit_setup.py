#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ofelia Box — audit des chaînes non traduites de l'assistant.

Traduire à l'œil une liste établie à la main garantit d'en oublier. Cet outil
recense TOUT le texte que l'utilisateur peut voir, et dit lequel est couvert
par le mécanisme de traduction.

Trois sources, parce que le texte de l'assistant vient de trois endroits :

  1. Le gabarit HTML          — nœuds de texte, placeholder, title, alt, value
  2. Le JavaScript de la page — chaînes injectées dans le DOM
                                (textContent, innerHTML, alert…)
  3. app.py                   — noms et descriptions des applications et des
                                bibliothèques, rendus côté serveur

Sortie : la liste des chaînes NON couvertes, groupées par source, avec leur
numéro de ligne. Code de sortie 1 s'il en reste — utilisable comme garde-fou
avant un commit.

    python3 i18n_audit_setup.py            # rapport
    python3 i18n_audit_setup.py --json     # pour outillage
"""

import html
import json
import pathlib
import re
import sys

BASE = pathlib.Path("/opt/edubox/setup")
TPL = BASE / "templates" / "index.html"
# La page des identifiants porte son PROPRE catalogue (FEAT-046) : l'auditer
# separement, sinon le gate sort 0 en ne la regardant pas.
CREDS = BASE / "templates" / "credentials.html"
APP = BASE / "app.py"

# Un texte est « visible » s'il contient au moins deux lettres consécutives.
# Filtre les « — », « : », « 5 Mo », « ✓ » et autres fragments non traduisibles.
A_DES_LETTRES = re.compile(r"[A-Za-zÀ-ÿ]{2,}")

# Mots-outils français : leur présence distingue un texte à traduire d'un nom
# propre ou d'un terme technique identique dans toutes les langues
# (« Moodle », « MariaDB », « SSID », « admin »).
INDICES_FR = re.compile(
    r"\b(le|la|les|un|une|des|du|de|et|ou|à|au|aux|en|dans|sur|pour|par|avec|"
    r"sans|est|sont|sera|être|a|as|ont|ce|cet|cette|ces|qui|que|quoi|si|"
    r"vide|laisse|choisis|clique|vérifie|branche|recharge|installer|"
    r"terminé|terminée|cours|erreur|réussi|échec|aucun|aucune|tous|toutes|"
    r"mot|passe|nom|réseau|fichier|image|page|box|utilisateur|"
    r"chargement|détection|recherche|connexion|installation|configuration)\b",
    re.I)

# Ce qui n'est jamais du texte destiné à l'utilisateur.
IGNORER = re.compile(
    r"^(https?://|/|#|\.|[0-9.,%\s:;+\-–—/()\[\]{}<>|=*&_]+$"
    r"|[A-Za-z0-9_-]+\.(png|jpg|jpeg|svg|css|js|json|crt|zim|html)$)"
)

# Termes techniques ou noms propres identiques dans toutes les langues.
BLANCHE = {
    "ofelia", "moodle", "kolibri", "kiwix", "calibre", "calibre-web",
    "pmb", "slims", "koha", "español", "français", "english", "khan academy",
    "gutenberg", "wikisource", "wikipedia", "project gutenberg",
    "zerotier vpn", "huggingface", "raspberry pi", "ofeliascan",
    "digistorm", "bibliofelia", "mariadb", "wikipedia", "wikisource",
    "gutenberg", "zerotier", "portainer", "docker", "ssid", "wifi", "lan",
    "usb", "ssl", "admin", "root", "lsusb", "api", "url", "ip", "dns",
    "sqlite", "redis", "memcached", "nginx", "khan academy", "epub", "zim",
    "jpeg", "png", "webp", "html", "css", "js", "ofelia.box", "ofelia-ca.crt",
}


# Une taille de fichier (« 3.4 Go », « 236 Go ⚠️ ») n'est pas du texte à
# traduire : le moteur convertit l'unité à l'affichage.
TAILLE = re.compile(r"^[~<>]?\s*[\d.,\s]+\s*(Go|Mo|GB|MB|To|TB)[\s⚠️!]*$")


def visible(txt):
    """Ce fragment est-il du texte affiché à un humain ?"""
    t = txt.strip()
    if TAILLE.match(t):
        return False
    if len(t) < 2 or not A_DES_LETTRES.search(t):
        return False
    if IGNORER.match(t):
        return False
    # Les emoji et drapeaux ne comptent pas : « 🇪🇸 Español » doit se
    # reconnaitre comme « español », un nom de langue ecrit dans sa propre
    # langue — donc identique dans toutes les traductions.
    nu = re.sub(r"[^\w\s.-]", "", t, flags=re.UNICODE).strip().lower()
    if nu in BLANCHE or t.lower().strip("«»\"' .:!?") in BLANCHE:
        return False
    return True


def ligne_de(src, pos):
    return src.count("\n", 0, pos) + 1


def audit_html(src):
    """Texte du gabarit non couvert par data-i18n."""
    trouves = []

    # On retire scripts et styles : traités séparément.
    masque = list(src)
    for m in re.finditer(r"<(script|style)\b.*?</\1>", src, re.S | re.I):
        for i in range(m.start(), m.end()):
            masque[i] = " "
    sans_js = "".join(masque)

    # Les éléments porteurs d'un data-i18n : on marque leur contenu comme
    # couvert, ainsi que celui de leurs descendants directs.
    couverts = []
    for m in re.finditer(r"<(\w+)[^>]*\bdata-i18n=[\"'][^\"']+[\"'][^>]*>", sans_js):
        tag = m.group(1)
        fin = sans_js.find("</%s>" % tag, m.end())
        couverts.append((m.start(), fin if fin > 0 else m.end()))

    def est_couvert(pos):
        return any(a <= pos <= b for a, b in couverts)

    # 1) nœuds de texte
    for m in re.finditer(r">([^<>]+)<", sans_js):
        txt = html.unescape(m.group(1))
        if not visible(txt):
            continue
        if est_couvert(m.start()):
            continue
        trouves.append({
            "ligne": ligne_de(src, m.start(1)),
            "texte": txt.strip(),
            "type": "texte",
        })

    # 2) attributs visibles
    for attr in ("placeholder", "title", "alt"):
        for m in re.finditer(r'\b%s=(["\'])(.*?)\1' % attr, sans_js, re.S):
            txt = html.unescape(m.group(2))
            if not visible(txt):
                continue
            # placeholder couvert par data-i18n-ph sur le même élément ?
            debut_balise = sans_js.rfind("<", 0, m.start())
            balise = sans_js[debut_balise:m.end() + 200].split(">")[0]
            if "data-i18n-ph=" in balise and attr == "placeholder":
                continue
            if "data-i18n-%s=" % attr in balise:
                continue
            trouves.append({
                "ligne": ligne_de(src, m.start(2)),
                "texte": txt.strip(),
                "type": attr,
            })

    return trouves


def sans_commentaires(bloc):
    """Blanchit les commentaires JS en gardant les positions intactes.

    Indispensable : un commentaire français contient des apostrophes
    (« n'est », « d'un ») que l'analyse de chaînes prendrait pour des
    délimiteurs, décalant tout le reste du fichier. Sans ça, l'audit
    signale ses propres commentaires comme du texte à traduire.

    On remplace par des espaces plutôt que de supprimer, pour que les
    numéros de ligne restent justes.
    """
    out = list(bloc)
    i, n = 0, len(bloc)
    while i < n:
        c = bloc[i]
        # Chaîne : on la saute en respectant les échappements.
        if c in "\"'`":
            q = c
            i += 1
            while i < n:
                if bloc[i] == "\\":
                    i += 2
                    continue
                if bloc[i] == q:
                    i += 1
                    break
                i += 1
            continue
        # Commentaire de ligne
        if c == "/" and i + 1 < n and bloc[i + 1] == "/":
            while i < n and bloc[i] != "\n":
                out[i] = " "
                i += 1
            continue
        # Commentaire de bloc
        if c == "/" and i + 1 < n and bloc[i + 1] == "*":
            while i < n and not (bloc[i] == "*" and i + 1 < n
                                 and bloc[i + 1] == "/"):
                if bloc[i] != "\n":
                    out[i] = " "
                i += 1
            for k in range(i, min(i + 2, n)):
                out[k] = " "
            i += 2
            continue
        i += 1
    return "".join(out)


def audit_js(src):
    """Chaînes du JavaScript injectées dans la page."""
    trouves = []
    for m in re.finditer(r"<script\b[^>]*>(.*?)</script>", src, re.S | re.I):
        bloc = sans_commentaires(m.group(1))
        depart = m.start(1)

        # Le dictionnaire de traduction lui-même : à ignorer, sinon il se
        # signalerait comme « non traduit ».
        dico = re.search(r"var T = \{.*?\n\};", bloc, re.S)
        zone_dico = (dico.start(), dico.end()) if dico else (-1, -1)

        # Guillemets simples/doubles (sur une ligne) et gabarits à accents
        # inverses (multi-lignes, avec des ${...} à retirer).
        motifs = [
            (r"(['\"])((?:\\.|(?!\1)[^\\\n])*)\1", False),
            (r"`((?:\\.|[^\\`])*)`", True),
        ]
        for motif, gabarit in motifs:
            for sm in re.finditer(motif, bloc, re.S):
                if zone_dico[0] <= sm.start() <= zone_dico[1]:
                    continue
                brut = sm.group(1) if gabarit else sm.group(2)
                pos = sm.start(1) if gabarit else sm.start(2)

                # Dans un gabarit, ${expression} est du code, pas du texte.
                txt = re.sub(r"\$\{[^}]*\}", " ", brut) if gabarit else brut
                # Le balisage HTML incorporé n'est pas du texte non plus.
                txt = re.sub(r"<[^>]+>", " ", txt)
                txt = re.sub(r"\s+", " ", txt).strip()

                if not visible(txt):
                    continue
                # Un identifiant ou un sélecteur n'est pas du texte affiché :
                # pas d'espace et des tirets/underscores le trahissent.
                if " " not in txt and re.fullmatch(r"[\w.#-]+", txt):
                    continue
                # Une chaîne n'est du texte d'interface que si elle contient
                # des mots français ; le reste est du CSS, du JSON, une URL.
                if not INDICES_FR.search(txt):
                    continue
                trouves.append({
                    "ligne": ligne_de(src, depart + pos),
                    "texte": txt,
                    "type": "js",
                })
    return trouves


def audit_python(src, gabarit):
    """Textes rendus côté serveur : noms et descriptions des catalogues.

    Ces chaînes ne sont visibles que si le gabarit les rend réellement.
    Tant qu'il ne contient aucune balise Jinja, `render_template(..., apps=APPS)`
    passe des données que personne n'affiche : les signaler serait une fausse
    alerte, et une fausse alerte finit par faire ignorer l'outil.
    """
    if "{%" not in gabarit and "{{" not in gabarit:
        return []
    trouves = []
    for m in re.finditer(r'"(?:name|desc|label|title)":\s*"((?:[^"\\]|\\.)+)"',
                         src):
        txt = m.group(1)
        if not visible(txt):
            continue
        trouves.append({
            "ligne": ligne_de(src, m.start(1)),
            "texte": txt.strip(),
            "type": "catalogue",
        })
    return trouves


def main():
    src_html = TPL.read_text(encoding="utf-8")
    src_py = APP.read_text(encoding="utf-8")

    resultats = {
        "gabarit HTML": audit_html(src_html),
        "JavaScript de la page": audit_js(src_html),
        "catalogues (app.py)": audit_python(src_py, src_html),
    }

    # Page des identifiants : meme traitement, catalogue distinct.
    if CREDS.exists():
        src_creds = CREDS.read_text(encoding="utf-8")
        resultats["page des identifiants (HTML)"] = audit_html(src_creds)
        resultats["page des identifiants (JS)"] = audit_js(src_creds)

    total = sum(len(v) for v in resultats.values())

    if "--json" in sys.argv:
        print(json.dumps(resultats, ensure_ascii=False, indent=2))
        return 1 if total else 0

    print("=" * 68)
    print("  AUDIT DES TRADUCTIONS — assistant d'administration")
    print("=" * 68)

    for source, items in resultats.items():
        print("\n%s : %d chaine(s) non traduite(s)" % (source, len(items)))
        if not items:
            print("   tout est couvert")
            continue
        vus = set()
        for it in items:
            cle = it["texte"]
            if cle in vus:
                continue
            vus.add(cle)
            t = it["texte"]
            if len(t) > 78:
                t = t[:75] + "..."
            print("   L%-5d [%-11s] %s" % (it["ligne"], it["type"], t))

    print("\n" + "-" * 68)
    print("  TOTAL : %d chaine(s) a traduire" % total)
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
