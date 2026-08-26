#!/usr/bin/env python3
"""
outils/captures.py — les captures de boutique, prises dans le vrai jeu.

    python3 outils/captures.py --sortie store/screenshots/fr-FR/phone

⚠️ ON NE PHOTOGRAPHIE PAS UNE MAQUETTE. Les captures precedentes montraient une
disposition qui n'existe plus : deux bandeaux de joueur en haut et en bas, pas de
bandeau du bas. Une boutique qui montre autre chose que l'application est un
motif de refus (Apple 2.3.3), et de toute facon une promesse qu'on ne tient pas.
Cet outil pilote donc le SIMULATEUR, sur le serveur reel.

⚠️ LES COORDONNEES SONT DES FRACTIONS, JAMAIS DES PIXELS. Le simulateur affiche
l'appareil dans une fenetre dont la taille depend de l'ecran du Mac et du zoom.
Un clic en pixels marche une fois, sur une machine. En fractions de la fenetre,
il marche sur toutes.

⛔ CET OUTIL COMPTAIT LES SECONDES, ET C'ETAIT SA MALADIE. Il enchainait des
gestes a l'aveugle en dormant 2,5 s entre chacun : quand une modale s'ouvrait
plus lentement que prevu, TOUS les gestes suivants tombaient a cote et les sept
captures montraient le meme ecran. Son propre en-tete annoncait la reparation —
« lire l'ecran entre deux gestes plutot que compter les secondes » — et personne
ne l'avait faite. Elle est faite.

COMMENT IL LIT. Il ne reconnait pas les boutons : il compare des captures. Deux
outils suffisent, et ils couvrent tout :

  attendre_calme()      — attend que deux captures consecutives se ressemblent,
                          c'est-a-dire que l'ecran a fini de bouger.
  taper()               — active la fenetre, clique, puis EXIGE que l'ecran ait
                          change. Si rien ne bouge, le clic n'est pas arrive :
                          il recommence, jusqu'a trois fois, puis se plaint.

C'est ce dernier point qui repare le defaut de fond. Un clic perdu ne decale
plus la suite : il est rejoue.

⚠️ LE PREMIER CLIC NE COMPTE PAS. macOS le consomme pour donner le focus a la
fenetre. On en brule donc un sur une zone morte avant de commencer — et comme
`taper` verifie desormais ses effets, un clic mange se rattrape tout seul.
"""
import argparse
import os
import subprocess
import time

BUNDLE = "com.nabil.piratesdice"


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)


def fenetre():
    """Position et taille de la fenetre du simulateur, en points d'ecran."""
    pos = sh("""osascript -e 'tell application "System Events" to tell process "Simulator" """
             """to get position of window 1'""").stdout.strip()
    taille = sh("""osascript -e 'tell application "System Events" to tell process "Simulator" """
                """to get size of window 1'""").stdout.strip()
    if not pos or not taille:
        raise SystemExit("le simulateur n'est pas ouvert")
    x, y = (int(n) for n in pos.split(", "))
    l, h = (int(n) for n in taille.split(", "))
    # ⚠️ IL N'Y A PAS DE BARRE DE TITRE A DEDUIRE, ET EN DEDUIRE UNE DECALE TOUT.
    # On retranchait 28 points « pour la barre » : les clics tombaient alors
    # 32 points plus bas sur l'appareil, soit un doigt entier. La preuve tient en
    # une division : la fenetre fait 825 x 380, soit un rapport de 2,17,
    # exactement celui de l'appareil (956 / 440).
    return x, y, l, h, (h / l if l else 0)


def controler_fenetre():
    x, y, l, h, rapport = fenetre()
    if not (1.6 < rapport < 2.6):
        raise SystemExit("fenetre de rapport %.2f : ce n'est pas un telephone en portrait"
                         % rapport)
    print("   fenetre %d x %d — rapport %.3f, conforme" % (l, h, rapport))


# ── LIRE L'ECRAN ─────────────────────────────────────────────────────────────

def _empreinte():
    """Une capture reduite, en niveaux de gris : de quoi COMPARER deux ecrans
    sans se soucier d'un pixel d'antialiasing ou d'une horloge qui avance."""
    from PIL import Image
    tmp = "/tmp/_pd_ecran.png"
    sh("xcrun simctl io booted screenshot '%s'" % tmp)
    if not os.path.exists(tmp):
        return None
    im = Image.open(tmp).convert("L").resize((44, 96), Image.BILINEAR)
    return list(im.getdata())


def _ecart(a, b):
    """La difference moyenne entre deux empreintes, sur 255."""
    if not a or not b or len(a) != len(b):
        return 255
    return sum(abs(p - q) for p, q in zip(a, b)) / len(a)


SEUIL_BOUGE = 3.0     # au-dela, l'ecran a change
SEUIL_CALME = 1.2     # en deca, il a fini de bouger


def attendre_calme(plafond=6.0):
    """Attend que l'ecran cesse de bouger, et rend son empreinte."""
    fin = time.time() + plafond
    avant = _empreinte()
    while time.time() < fin:
        time.sleep(0.35)
        apres = _empreinte()
        if _ecart(avant, apres) < SEUIL_CALME:
            return apres
        avant = apres
    return avant


def taper(fx, fy, attendre=True, essais=3, plafond=8.0):
    """Un appui, et la PREUVE qu'il est arrive.

    ⚠️ `cliclick c:` SEUL RATE UNE FOIS SUR TROIS. Sans deplacement prealable,
    le simulateur recoit parfois le clic sans que le survol ait suivi, et la vue
    web ne voit rien passer. `m:` puis `c:`, avec une pause entre les deux,
    tombe juste a chaque fois — mesure sur une centaine de gestes.
    """
    x, y, l, h, _ = fenetre()
    px, py = int(x + fx * l), int(y + fy * h)
    for essai in range(1, essais + 1):
        avant = _empreinte()
        sh("""osascript -e 'tell application "Simulator" to activate'""")
        time.sleep(0.25)
        sh("cliclick m:%d,%d w:150 c:%d,%d" % (px, py, px, py))
        if not attendre:
            time.sleep(0.4)
            return True
        fin = time.time() + plafond
        while time.time() < fin:
            time.sleep(0.3)
            if _ecart(avant, _empreinte()) > SEUIL_BOUGE:
                attendre_calme()
                return True
        print("   ↻ rien n'a bouge en (%.2f, %.2f) — essai %d" % (fx, fy, essai))
    print("   ⚠ geste sans effet en (%.2f, %.2f), on continue quand meme" % (fx, fy))
    return False


def tenir(fx, fy, duree=1.2):
    """Un appui MAINTENU : la cale a bonus ne s'ouvre qu'ainsi, et se referme
    des qu'on relache. On rend la main au relachement a l'appelant."""
    x, y, l, h, _ = fenetre()
    px, py = int(x + fx * l), int(y + fy * h)
    sh("""osascript -e 'tell application "Simulator" to activate'""")
    time.sleep(0.25)
    sh("cliclick m:%d,%d w:200 dd:%d,%d" % (px, py, px, py))
    time.sleep(duree)
    return lambda: sh("cliclick du:%d,%d" % (px, py))


def photo(chemin):
    os.makedirs(os.path.dirname(chemin) or ".", exist_ok=True)
    attendre_calme()
    sh("xcrun simctl io booted screenshot '%s'" % chemin)
    ok = os.path.exists(chemin)
    print("   %s %s" % ("📸" if ok else "✖", os.path.basename(chemin)))
    return ok


# ── LE PARCOURS ──────────────────────────────────────────────────────────────

# Toutes les cibles, en fractions de la fenetre. Un seul endroit a corriger si
# la mise en page bouge.
LANCER   = (0.50, 0.950)
CALE     = (0.155, 0.950)
QUITTER  = (0.845, 0.950)
COLONNES = [(0.27, 0.76), (0.50, 0.76), (0.73, 0.76)]
DEFIER   = (0.50, 0.641)
ONGLETS  = {"boutique": (0.45, 0.082), "classement": (0.625, 0.082),
            "regles": (0.785, 0.082)}
FERMER      = (0.92, 0.082)
ABANDON_OUI = (0.712, 0.249)
FIN_LE_PONT = (0.666, 0.548)


def au_pont():
    """Revenir au menu, quoi qu'il y ait a l'ecran. Ces gestes ne rencontrent
    rien quand la partie n'est pas commencee : ils tombent dans le vide."""
    taper(*FIN_LE_PONT, attendre=False)
    taper(*QUITTER, attendre=False)
    taper(*ABANDON_OUI, attendre=False)
    attendre_calme()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sortie", required=True, help="dossier ou deposer les captures")
    ap.add_argument("--tours", type=int, default=6,
                    help="tours joues avant de photographier l'arene")
    args = ap.parse_args()

    controler_fenetre()
    # Le clic sacrificiel : celui que macOS consomme pour le focus.
    taper(0.5, 0.30, attendre=False)

    faites, ratees = [], []

    def prendre(nom):
        (faites if photo(os.path.join(args.sortie, nom + ".png")) else ratees).append(nom)

    au_pont()
    prendre("1_menu")                      # le pont, et ses cinq capitaines

    # ⛔ IL Y AVAIT ICI DEUX GESTES POUR LA CARTE DE MISE, ET ELLE N'EXISTE PLUS.
    # La mise a ete retiree du jeu (Apple refuse la simulation de pari sur un
    # compte individuel) : la partie demarre desormais des le defi lance. Deux
    # gestes de trop, et c'etait tout le parcours qui se decalait.
    taper(*DEFIER)                         # affronter l'IA — on arrive dans l'arene

    # ⚠️ UN PLATEAU VIDE NE DONNE ENVIE A PERSONNE. On joue quelques tours avant
    # de photographier : ce qu'on vend est la partie, pas l'ecran de depart.
    for tour in range(args.tours):
        taper(*LANCER)
        taper(*COLONNES[tour % 3])
    prendre("2_plateau")                   # l'arene, des poses des deux cotes

    # ⚠️ LA CALE S'OUVRE A L'APPUI MAINTENU, PAS AU CLIC. Un clic l'ouvre et la
    # referme dans le meme geste : la capture montrait le bandeau nu.
    relacher = tenir(*CALE, duree=1.4)
    prendre("3_cale")                      # l'eventail des effets, fond assombri
    relacher()
    attendre_calme()

    for nom, onglet in (("4_boutique", "boutique"), ("5_classement", "classement"),
                        ("6_regles", "regles")):
        taper(*ONGLETS[onglet])
        prendre(nom)
        taper(*FERMER)

    print()
    print("   %d capture(s) prise(s)%s" % (len(faites),
          (", %d manquee(s) : %s" % (len(ratees), ", ".join(ratees))) if ratees else ""))
    # ⚠️ UN PARCOURS QUI DERIVE PRODUIT N FOIS LE MEME ECRAN. On le dit ici
    # plutot que de laisser l'oeil le decouvrir trois jours plus tard.
    doublons = doublons_parmi(args.sortie, faites)
    if doublons:
        print("   ⚠ captures identiques entre elles : %s" % " / ".join(doublons))
        print("     le parcours a derive — corriger les cibles avant de publier.")
    else:
        print("   toutes les captures different les unes des autres.")


def doublons_parmi(dossier, noms):
    from PIL import Image
    vus, pareils = {}, []
    for nom in noms:
        chemin = os.path.join(dossier, nom + ".png")
        if not os.path.exists(chemin):
            continue
        im = Image.open(chemin).convert("L").resize((44, 96), Image.BILINEAR)
        e = list(im.getdata())
        for autre, f in vus.items():
            if _ecart(e, f) < SEUIL_CALME:
                pareils.append("%s = %s" % (autre, nom))
        vus[nom] = e
    return pareils


if __name__ == "__main__":
    main()
