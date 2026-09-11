#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
#  OFELIA BOX — DÉMARRAGE ORDONNÉ DES APPLICATIONS
# ══════════════════════════════════════════════════════════════════════
#
#  Pourquoi ce script existe
#  -------------------------
#  Au démarrage, Docker lançait les 14 conteneurs simultanément. La carte SD
#  saturait (jusqu'à 90 % d'attente d'entrées/sorties), le démarrage prenait
#  10 à 15 minutes, et pendant tout ce temps l'usager n'avait AUCUN signe de
#  vie : le portail répondait mais chaque application renvoyait « 502 Bad
#  Gateway ». Sur un site distant, on en conclut que la Box est en panne.
#
#  Ce script démarre les applications UNE PAR UNE, dans l'ordre d'importance
#  décidé par Val, et publie l'avancement dans un fichier que la page de
#  démarrage relit en continu.
#
#  Ordre de démarrage (ordre d'importance, pas ordre technique) :
#    1. Portail et assistant   5. Bibliothèques hors-ligne
#    2. BibliOfelia            6. Calibre
#    3. Moodle                 7. Digistorm
#    4. Kolibri
#
#  Toute nouvelle application s'ajoute à la fin de la liste ETAPES, dans son
#  ordre d'installation. Rien d'autre n'est à modifier : la page de démarrage
#  lit la liste depuis le fichier d'état.
#
#  Le portail et l'assistant ne figurent pas dans les conteneurs à démarrer :
#  ils sont en `restart: unless-stopped` et Docker les relance donc lui-même
#  dès l'allumage, pour que la page de démarrage soit visible immédiatement.
#
# ══════════════════════════════════════════════════════════════════════

set -uo pipefail

EDUBOX=/opt/edubox
PORTAL="$EDUBOX/portal"
STATUS="$PORTAL/boot-status.json"
BOOT_PAGE="$PORTAL/boot.html"
BOOT_ACTIVE="$PORTAL/boot-active.html"
LOG="$EDUBOX/data/boot.log"

# Délai maximal d'attente par étape. Dépassé, on passe à la suivante : une
# application en panne ne doit jamais bloquer les autres.
ETAPE_TIMEOUT=${ETAPE_TIMEOUT:-600}

mkdir -p "$EDUBOX/data"
exec >> "$LOG" 2>&1
echo "════════ $(date '+%F %T') — démarrage de la séquence ════════"

# ── La liste ──────────────────────────────────────────────────────────
#  id | conteneurs à démarrer (dans l'ordre) | URL de vérification
#  L'URL sert à savoir si l'APPLICATION répond, pas seulement si le
#  conteneur tourne : un conteneur « Up » dont l'application démarre encore
#  renvoie toujours 502, c'est précisément ce qu'on veut éviter d'annoncer
#  comme terminé.
ETAPES=(
  "portail|edubox-healthcheck|http://localhost/"
  "bibliofelia|edubox-bibliofelia edubox-bibliofelia-worker|http://localhost/bibliofelia/"
  "moodle|edubox-mariadb edubox-memcached edubox-moodle|http://localhost/moodle/"
  "kolibri|edubox-kolibri|http://localhost/kolibri/"
  "bibliotheques|edubox-kiwix|http://localhost/wiki/"
  "calibre|edubox-calibre|http://localhost/calibre/"
  "digistorm|edubox-redis edubox-digistorm|http://localhost:3000/"
  "outils|edubox-portainer|"
)

TOTAL=${#ETAPES[@]}
declare -a ETAT_ID ETAT_STATE ETAT_SEC ETAT_URL
for ((i = 0; i < TOTAL; i++)); do
    ETAT_ID[$i]="${ETAPES[$i]%%|*}"
    ETAT_STATE[$i]="attente"
    ETAT_SEC[$i]=0
    # L'URL de vérification, publiée dans le fichier d'état : elle permet à
    # l'assistant de revérifier une étape en échec plutôt que d'afficher
    # indéfiniment un verdict figé au démarrage.
    ETAT_URL[$i]="${ETAPES[$i]##*|}"
done

# ── Horloge monotone ──────────────────────────────────────────────────
# `date +%s` donne l'heure murale, que NTP déplace en cours de démarrage
# (le Pi 5 n'a pas de pile d'horloge et repart à une heure fausse). Les
# durées mesurées avec elle étaient donc fantaisistes. /proc/uptime compte
# depuis l'allumage et ne bouge jamais.
mono() { awk '{printf "%d", $1}' /proc/uptime; }

DEBUT=$(mono)

# ── L'heure est-elle fiable ? ─────────────────────────────────────────
# Sans internet il n'y a pas de NTP, et le Pi 5 n'a pas de pile d'horloge :
# il repart de la dernière heure enregistrée. La page de démarrage propose
# alors une correction manuelle — mais seulement dans ce cas, car si NTP
# fonctionne c'est lui qui fait autorité.
heure_synchronisee() {
    local v
    v=$(timedatectl show -p NTPSynchronized --value 2>/dev/null)
    [ "$v" = "yes" ] && return 0
    return 1
}

# ── Publication de l'état ─────────────────────────────────────────────
# Écriture atomique : la page relit ce fichier toutes les 2 secondes et ne
# doit jamais tomber sur un JSON tronqué.
publier() {
    # `local` est indispensable ici : sans lui, la boucle interne écraserait
    # le compteur de la boucle principale — bash n'a pas de portée locale
    # implicite, et la séquence s'arrêtait alors au premier tour.
    local global="$1" courant="$2"
    local tmp="$STATUS.tmp"
    local ntp="false"
    local k
    heure_synchronisee && ntp="true"

    {
        printf '{\n'
        printf '  "etat": "%s",\n' "$global"
        printf '  "courant": %d,\n' "$courant"
        printf '  "total": %d,\n' "$TOTAL"
        printf '  "ecoule": %d,\n' "$(($(mono) - DEBUT))"
        printf '  "maintenant": "%s",\n' "$(date '+%F %T')"
        printf '  "heure_fiable": %s,\n' "$ntp"
        printf '  "etapes": [\n'
        for ((k = 0; k < TOTAL; k++)); do
            printf '    {"id": "%s", "etat": "%s", "secondes": %d, "url": "%s"}' \
                   "${ETAT_ID[$k]}" "${ETAT_STATE[$k]}" "${ETAT_SEC[$k]}" \
                   "${ETAT_URL[$k]}"
            [ $k -lt $((TOTAL - 1)) ] && printf ','
            printf '\n'
        done
        printf '  ]\n'
        printf '}\n'
    } > "$tmp"
    mv -f "$tmp" "$STATUS"
    chmod 644 "$STATUS" 2>/dev/null
}

# ── Attente qu'une application réponde vraiment ───────────────────────
# Tout code HTTP inférieur à 500 signifie que l'application a repris la
# main (302 vers une page de connexion compte comme prêt). 502/503/504 et
# 000 signifient qu'elle ne répond pas encore.
attendre_reponse() {
    # t0 et code doivent rester locaux : la boucle principale chronomètre
    # elle aussi avec sa propre variable.
    local url="$1" limite="$2" t0 code
    t0=$(mono)
    while :; do
        code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null)
        if [ -n "$code" ] && [ "$code" -lt 500 ] 2>/dev/null; then
            return 0
        fi
        [ $(($(mono) - t0)) -ge "$limite" ] && return 1
        sleep 3
    done
}

# ══════════════════════════════════════════════════════════════════════

# La page de progression prend la place du portail tant que la séquence
# tourne. `try_files /boot-active.html /index.html` côté nginx bascule tout
# seul, sans rechargement de configuration.
if [ -f "$BOOT_PAGE" ]; then
    cp -f "$BOOT_PAGE" "$BOOT_ACTIVE"
    chmod 644 "$BOOT_ACTIVE"
fi

publier "encours" 0

# Le portail et l'assistant doivent être là avant tout le reste : c'est ce
# qui rend la page de démarrage visible. Docker s'en charge normalement
# (`unless-stopped`), on ne fait que rattraper le cas contraire.
for c in edubox-nginx edubox-setup; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" != "true" ]; then
        echo "  → rattrapage : démarrage de $c"
        docker start "$c" >/dev/null 2>&1
    fi
done

for ((i = 0; i < TOTAL; i++)); do
    IFS='|' read -r id conteneurs url <<< "${ETAPES[$i]}"
    etape_t0=$(mono)
    ETAT_STATE[$i]="encours"
    publier "encours" $((i + 1))
    echo "── étape $((i + 1))/$TOTAL : $id"

    manquant=0
    for c in $conteneurs; do
        if ! docker inspect "$c" >/dev/null 2>&1; then
            echo "     conteneur absent, ignoré : $c"
            manquant=1
            continue
        fi
        echo "     démarrage de $c"
        docker start "$c" >/dev/null 2>&1
        # Laisser le conteneur prendre ses entrées/sorties avant le suivant :
        # c'est tout l'objet de la séquence, ne pas ressaturer la carte SD.
        sleep 2
    done

    if [ -n "$url" ]; then
        if attendre_reponse "$url" "$ETAPE_TIMEOUT"; then
            ETAT_STATE[$i]="pret"
        else
            ETAT_STATE[$i]="echec"
            echo "     PAS DE RÉPONSE après ${ETAPE_TIMEOUT}s — on continue"
        fi
    else
        # Étape sans URL (outils techniques) : rien à vérifier.
        ETAT_STATE[$i]=$([ "$manquant" = 1 ] && echo "absent" || echo "pret")
    fi

    ETAT_SEC[$i]=$(($(mono) - etape_t0))
    echo "     → ${ETAT_STATE[$i]} en ${ETAT_SEC[$i]}s"
    publier "encours" $((i + 1))
done

# ── Vérification finale ───────────────────────────────────────────────
# Une étape déclarée en échec a peut-être fini par répondre pendant que les
# suivantes démarraient : sur carte SD, une application lente n'est pas une
# application en panne. On les reteste donc une dernière fois, brièvement,
# plutôt que de laisser l'usager devant un « ne répond pas » périmé.
for ((i = 0; i < TOTAL; i++)); do
    [ "${ETAT_STATE[$i]}" = "echec" ] || continue
    IFS='|' read -r id conteneurs url <<< "${ETAPES[$i]}"
    [ -n "$url" ] || continue
    echo "── nouvelle vérification : $id"
    if attendre_reponse "$url" 120; then
        ETAT_STATE[$i]="pret"
        echo "     → répond finalement, corrigé en « prêt »"
        publier "encours" "$TOTAL"
    else
        echo "     → toujours aucune réponse"
    fi
done

publier "termine" "$TOTAL"

# La séquence est finie : le portail reprend sa place.
rm -f "$BOOT_ACTIVE"

echo "════════ terminé en $(($(mono) - DEBUT))s ════════"
