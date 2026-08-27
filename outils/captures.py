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

# ⚠️ « booted » DESIGNE N'IMPORTE LEQUEL DES SIMULATEURS ALLUMES, ET ON EN A
# SOUVENT DEUX. Un iPad s'est rallume tout seul en cours de route (Xcode le
# reveille) et `simctl io booted` a photographie SON ecran : trois captures
# noires de 2064 x 2752 avant qu'on ne comprenne. L'appareil se nomme donc, et
# une seule variable le porte jusqu'aux commandes.
APPAREIL = "booted"

# LA TRANSFORMATION FENETRE ↔ ECRAN, MESUREE SUR DEUX POINTS.
#
# ⛔ UNE SEULE CONSTANTE NE SUFFIT PAS, ET C'EST CE QUI A COUTE LE PLUS CHER.
# Ce fichier a d'abord affirme qu'il n'y avait pas de barre de titre — « la
# preuve tient en une division », le rapport de la fenetre etant celui de
# l'appareil. C'etait vrai, puis la fenetre est passee de 380 a 388 de large et
# le rapport n'a bouge que de 2 % : trop peu pour trahir la barre, assez pour
# que TOUS les clics de l'entete tombent cinquante points trop haut. Voila
# pourquoi « les onglets ne repondaient pas aux clics synthetiques » — ils
# repondaient tres bien, on ne les touchait pas.
#
# Puis j'ai retranche le decalage mesure sur l'entete, et les clics du bas se
# sont mis a rater : la fenetre ne contient pas l'ecran a la meme echelle en
# haut et en bas des qu'on se trompe sur sa hauteur utile. Un decalage seul ne
# peut pas decrire une droite.
#
# On mesure donc DEUX points — un en haut, un en bas — et on en tire
# `fenetre_y = A + B x ecran_y`. Deux inconnues, deux mesures.
CAL_A = 0.0
CAL_B = 0.0
CAL_FAITE = False


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
    # ⛔ « IL N'Y A PAS DE BARRE DE TITRE » : C'ETAIT VRAI, PUIS CA A CESSE DE
    # L'ETRE. Ce fichier affirmait la preuve par une division — fenetre 380 x 825,
    # rapport 2,17, exactement celui de l'appareil — et refusait de retrancher
    # quoi que ce soit. La fenetre fait maintenant 388 x 825 : il y a bien une
    # barre, et le rapport ne la voit pas puisqu'il change de moins de 3 %.
    #
    # Consequence : TOUS les clics sur l'entete tombaient vingt-cinq points trop
    # haut. C'est pour cela que les onglets « ne repondaient pas aux clics
    # synthetiques » — ils repondaient tres bien, on ne les touchait pas.
    #
    # On ne remplace pas une constante fausse par une autre : le decalage se
    # MESURE au demarrage (voir `calibrer`), une fois, sur cette machine et ce
    # niveau de zoom.
    return x, y, l, h, (h / l if l else 0)


def _cherche(fx, attendu, bas, haut, pas):
    """Balaie une colonne et rend la hauteur de FENETRE ou l'ecran a repondu.

    On appuie, on regarde. C'est la seule mesure qui ne mente pas : ni le
    rapport de la fenetre, ni `System Events`, ni une constante lue dans une
    documentation ne disent ou se trouve reellement le pixel qu'on vise.
    """
    x, y, l, h, _ = fenetre()
    depart = int(y + attendu * h)
    for delta in range(bas, haut, pas):
        py = depart + delta
        px = int(x + fx * l)
        avant = _empreinte()
        sh("""osascript -e 'tell application "Simulator" to activate'""")
        time.sleep(0.25)
        sh("cliclick m:%d,%d w:150 c:%d,%d" % (px, py, px, py))
        time.sleep(1.1)
        if _ecart(avant, _empreinte()) > SEUIL_BOUGE * 2:
            return py
    return None


def calibrer():
    """DEUX POINTS, ET LA DROITE QUI LES JOINT.

    Le haut : l'onglet de la boutique, a 8,2 % de l'ecran. Le bas : le bouton
    « quitter » du bandeau, a 95 %. Entre les deux, presque toute la hauteur —
    c'est ce qui rend la pente fiable. Deux cibles larges, toujours presentes,
    et dont l'effet se voit d'un coup d'oeil.

    ⚠️ ON REFERME CE QU'ON OUVRE. Chaque sonde laisse une feuille ou une carte
    a l'ecran ; sans les fermer, la sonde suivante taperait dedans et mesurerait
    la mauvaise chose.
    """
    global CAL_A, CAL_B, CAL_FAITE
    CAL_FAITE = False
    x, y, l, h, _ = fenetre()

    haut_ecran, bas_ecran = 0.082, 0.950
    trouve_haut = _cherche(0.45, haut_ecran, 0, 90, 4)
    if trouve_haut is None:
        print("   ⚠ calibrage : l'entete ne repond a aucune hauteur.")
        return False
    au_pont()                                  # on referme la feuille ouverte

    trouve_bas = _cherche(0.845, bas_ecran, -60, 40, 4)
    if trouve_bas is None:
        print("   ⚠ calibrage : le bandeau du bas ne repond a aucune hauteur.")
        return False
    au_pont()

    """La droite : deux points d'ecran connus, deux hauteurs de fenetre mesurees."""
    e1, e2 = haut_ecran, bas_ecran
    f1, f2 = trouve_haut - y, trouve_bas - y
    if abs(e2 - e1) < 1e-6:
        return False
    CAL_B = (f2 - f1) / (e2 - e1)
    CAL_A = f1 - CAL_B * e1
    CAL_FAITE = True
    print("   calibrage : ecran = %.0f px de fenetre, decale de %.0f px"
          % (CAL_B, CAL_A))
    return True


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
    sh("xcrun simctl io %s screenshot '%s'" % (APPAREIL, tmp))
    if not os.path.exists(tmp):
        return None
    # ⚠️ 44 x 96 NOYAIT LES PETITS CHANGEMENTS. Un de qui apparait dans le
    # gobelet ne bouge que trois pixels de cette vignette : l'outil concluait
    # « rien n'a bouge » et rejouait un geste qui avait pourtant porte. Quatre
    # fois plus de pixels, et un seuil plus bas : les grands changements restent
    # evidents, les petits cessent d'etre invisibles.
    im = Image.open(tmp).convert("L").resize((88, 192), Image.BILINEAR)
    return list(im.getdata())


def bouton_or():
    """OU EST LE BOUTON D'OR, MESURE SUR L'ECRAN — pas suppose.

    ⛔ SA POSITION ETAIT UNE CONSTANTE, ET LA CARTE D'ACCUEIL EST DEVENUE
    ELASTIQUE. Depuis qu'elle se mesure en hauteur d'ecran, ses trois boutons
    montent et descendent avec l'appareil : la fraction 0,641 tombait dans le
    VIDE entre « affronter l'IA » et « defier un joueur ». Le geste ne portait
    pas, le parcours restait au pont, et les cinq captures suivantes montraient
    le meme menu. Mesure du 2026-08-27 : le bouton est a 0,619.

    On le CHERCHE donc : c'est le seul aplat dore qui traverse la moitie de la
    largeur. Le porte-monnaie et les pastilles de score sont dores aussi, mais
    ils sont petits — le seuil de largeur les ecarte.
    """
    from PIL import Image
    tmp = "/tmp/_pd_or.png"
    sh("xcrun simctl io %s screenshot '%s'" % (APPAREIL, tmp))
    if not os.path.exists(tmp):
        return None
    im = Image.open(tmp).convert("RGB")
    w, h = im.size
    px = im.load()
    bandes, dans, debut = [], False, 0
    pas = max(1, h // 700)
    # ⚠️ ON NE REGARDE NI L'ENTETE NI LE BAS. Le bandeau du haut porte un
    # LISERE DORE sur toute la largeur : mesure du 2026-08-27, le bouton a ete
    # « trouve » a 0,112, c'est-a-dire dans le bandeau. Le bas, lui, portera le
    # bouton de lancer des qu'une partie sera ouverte.
    for y in range(int(h * 0.25), int(h * 0.92), pas):
        n = 0
        for x in range(0, w, 8):
            r, g, b = px[x, y]
            if r > 200 and g > 150 and b < 130:
                n += 1
        large = n > (w // 8) * 0.5
        if large and not dans:
            dans, debut = True, y
        elif not large and dans:
            dans = False
            bandes.append((debut, y))
    if dans:
        bandes.append((debut, int(h * 0.92)))
    if not bandes:
        return None
    # Les deux aretes d'un meme bouton (le texte, entre elles, n'est pas dore)
    # doivent compter pour UNE bande.
    fusion = [list(bandes[0])]
    for d, f in bandes[1:]:
        if d - fusion[-1][1] < h * 0.05:
            fusion[-1][1] = f
        else:
            fusion.append([d, f])
    d, f = max(fusion, key=lambda b: b[1] - b[0])
    # Un bouton fait quelques pourcents de haut ; un lisere, un dixieme de ça.
    if (f - d) < h * 0.015:
        return None
    return (d + f) / 2.0 / h


def _ecart(a, b):
    """La difference moyenne entre deux empreintes, sur 255."""
    if not a or not b or len(a) != len(b):
        return 255
    return sum(abs(p - q) for p, q in zip(a, b)) / len(a)


SEUIL_BOUGE = 1.4     # au-dela, l'ecran a change
SEUIL_CALME = 0.6     # en deca, il a fini de bouger


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


def point(fx, fy):
    """Une fraction d'ECRAN, rendue en pixels de FENETRE.

    Sans calibrage on suppose que la fenetre EST l'ecran. C'est faux — c'est
    justement le defaut qu'on repare — mais ca reste utilisable pour les grandes
    cibles du milieu, et ca evite qu'un oubli d'appel casse tout."""
    x, y, l, h, _ = fenetre()
    px = x + fx * l
    py = (y + CAL_A + CAL_B * fy) if CAL_FAITE else (y + fy * h)
    return int(px), int(py)


def taper(fx, fy, attendre=True, essais=3, plafond=8.0):
    """Un appui, et la PREUVE qu'il est arrive.

    ⚠️ `cliclick c:` SEUL RATE UNE FOIS SUR TROIS. Sans deplacement prealable,
    le simulateur recoit parfois le clic sans que le survol ait suivi, et la vue
    web ne voit rien passer. `m:` puis `c:`, avec une pause entre les deux,
    tombe juste a chaque fois — mesure sur une centaine de gestes.
    """
    px, py = point(fx, fy)
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
    px, py = point(fx, fy)
    sh("""osascript -e 'tell application "Simulator" to activate'""")
    time.sleep(0.25)
    sh("cliclick m:%d,%d w:200 dd:%d,%d" % (px, py, px, py))
    time.sleep(duree)
    return lambda: sh("cliclick du:%d,%d" % (px, py))


def photo(chemin):
    os.makedirs(os.path.dirname(chemin) or ".", exist_ok=True)
    attendre_calme()
    sh("xcrun simctl io %s screenshot '%s'" % (APPAREIL, chemin))
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
# Un point qui ne joue rien : entre le plateau d'en face et le bandeau du haut.
VIDE        = (0.06, 0.30)
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
    ap.add_argument("--appareil", default="booted",
                    help="l'identifiant du simulateur a photographier ; "
                         "obligatoire des que deux sont allumes")
    args = ap.parse_args()
    global APPAREIL
    APPAREIL = args.appareil
    allumes = [l for l in sh("xcrun simctl list devices booted").stdout.splitlines()
               if "Booted" in l]
    if len(allumes) > 1 and args.appareil == "booted":
        raise SystemExit(
            "deux simulateurs sont allumes — nommez celui a photographier :\n"
            + "\n".join("   " + l.strip() for l in allumes)
            + "\n   (--appareil <identifiant>)")

    controler_fenetre()
    # Le clic sacrificiel : celui que macOS consomme pour le focus.
    taper(0.5, 0.30, attendre=False)
    # ⚠️ AVANT TOUT GESTE UTILE. Sans cette mesure, l'entete est hors d'atteinte
    # et le parcours produit trois fois la meme photo de l'arene.
    calibrer()

    faites, ratees = [], []

    def prendre(nom):
        (faites if photo(os.path.join(args.sortie, nom + ".png")) else ratees).append(nom)

    au_pont()
    prendre("1_menu")                      # le pont, et ses cinq capitaines

    # ⛔ IL Y AVAIT ICI DEUX GESTES POUR LA CARTE DE MISE, ET ELLE N'EXISTE PLUS.
    # La mise a ete retiree du jeu (Apple refuse la simulation de pari sur un
    # compte individuel) : la partie demarre desormais des le defi lance. Deux
    # gestes de trop, et c'etait tout le parcours qui se decalait.
    y = bouton_or() or DEFIER[1]
    if abs(y - DEFIER[1]) > 0.01:
        print("   ↺ « affronter l'IA » mesure a %.3f (constante : %.3f)" % (y, DEFIER[1]))
    taper(DEFIER[0], y)                    # affronter l'IA — on arrive dans l'arene

    # ⚠️ UN PLATEAU VIDE NE DONNE ENVIE A PERSONNE. On joue quelques tours avant
    # de photographier : ce qu'on vend est la partie, pas l'ecran de depart.
    for tour in range(args.tours):
        taper(*LANCER)
        taper(*COLONNES[tour % 3])
    prendre("2_plateau")                   # l'arene, des poses des deux cotes

    # ⛔ ELLE S'OUVRAIT A L'APPUI MAINTENU, ELLE S'OUVRE MAINTENANT AU CLIC.
    # « On ne doit plus rester appuye longtemps » : un appui long est un geste
    # qu'on ne decouvre pas. Le parcours suivait l'ancien geste — il tenait le
    # bouton, la cale s'ouvrait puis se refermait, et les trois captures
    # suivantes montraient le meme ecran. Vu le 2026-08-27.
    taper(*CALE)
    prendre("3_cale")                      # l'eventail des effets, fond assombri
    # Un geste dans le vide referme la cale SANS jouer de coup (c'est la regle
    # depuis qu'un clic de fermeture a coute une partie a l'admin).
    taper(*VIDE, attendre=False)
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
        im = Image.open(chemin).convert("L").resize((88, 192), Image.BILINEAR)
        e = list(im.getdata())
        for autre, f in vus.items():
            if _ecart(e, f) < SEUIL_CALME:
                pareils.append("%s = %s" % (autre, nom))
        vus[nom] = e
    return pareils


if __name__ == "__main__":
    main()
