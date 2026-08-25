#!/usr/bin/env python3
"""
outils/captures.py — les captures de boutique, prises dans le vrai jeu.

    python3 outils/captures.py --langue fr --sortie store/screenshots/fr-FR/phone

⚠️ ON NE PHOTOGRAPHIE PAS UNE MAQUETTE. Les captures precedentes montraient une
disposition qui n'existe plus : deux bandeaux de joueur en haut et en bas, pas de
bandeau du bas. Une boutique qui montre autre chose que l'application est un
motif de refus (Apple 2.3.3), et de toute facon une promesse qu'on ne tient pas.
Cet outil pilote donc le SIMULATEUR, sur le serveur reel.

⚠️ LES COORDONNEES SONT DES FRACTIONS, JAMAIS DES PIXELS. Le simulateur affiche
l'appareil dans une fenetre dont la taille depend de l'ecran du Mac et du zoom.
Un clic en pixels marche une fois, sur une machine. En fractions de la fenetre,
il marche sur toutes.

⚠️ ET CE PARCOURS RESTE FRAGILE — ne pas s'y fier les yeux fermes. Il enchaine
des gestes a l'aveugle : il ne LIT pas l'ecran, il suppose ou se trouvent les
boutons. Trois derives ont deja ete vues et corrigees — le premier clic mange
par le focus de la fenetre, un decalage de 28 points invente pour une barre de
titre qui n'existe pas, et une carte de fin de partie qui bloquait l'entete.
Il en reste : une modale qui s'ouvre plus lentement que prevu, et tous les
gestes suivants tombent a cote.

DONC : regarder la planche de controle apres chaque passage. Un enchainement
qui derive produit sept fois le meme ecran, ce qui se voit d'un coup d'oeil —
mais seulement si on le donne. La vraie reparation serait de LIRE l'ecran entre
deux gestes plutot que de compter les secondes ; c'est le prochain pas.
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
    # 32 points plus bas sur l'appareil, soit un doigt entier. Les boutons du
    # bandeau, larges, encaissaient ; l'entete, non — la boutique ne s'ouvrait
    # jamais et le clic posait un de a la place.
    # La preuve tient en une division : la fenetre fait 825 x 380, soit un
    # rapport de 2,17, exactement celui de l'appareil (956 / 440). Il n'y a donc
    # rien d'autre que l'ecran dans cette fenetre.
    rapport_fenetre = h / l
    return x, y, l, h, rapport_fenetre


def controler_fenetre():
    """La fenetre montre-t-elle l'ecran, et rien d'autre ?

    Un cadre d'appareil, une barre, un zoom non uniforme : tout cela decale les
    clics sans rien dire. On compare donc le rapport de la fenetre a celui de
    l'appareil AVANT de commencer — un decalage de 28 points a deja fait poser
    des des au lieu d'ouvrir la boutique.
    """
    _, _, l, h, rapport = fenetre()
    attendu = 956 / 440                      # iPhone 17 Pro Max, en points
    if abs(rapport - attendu) > 0.03:
        raise SystemExit(
            "la fenetre (%d x %d, rapport %.3f) ne correspond pas a l'ecran "
            "(%.3f) : un cadre ou une barre s'y trouve, et les clics tomberaient "
            "a cote." % (l, h, rapport, attendu))
    print("   fenetre %d x %d — rapport %.3f, conforme" % (l, h, rapport))


def clic(fx, fy):
    x, y, l, h, _ = fenetre()
    sh("cliclick c:%d,%d" % (x + fx * l, y + fy * h))


def photo(chemin):
    os.makedirs(os.path.dirname(chemin) or ".", exist_ok=True)
    sh("xcrun simctl io booted screenshot '%s'" % chemin)
    print("   ", os.path.basename(chemin))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sortie", required=True, help="dossier ou deposer les captures")
    ap.add_argument("--attente", type=float, default=2.5, help="secondes entre deux gestes")
    args = ap.parse_args()

    sh("""osascript -e 'tell application "Simulator" to activate'""")
    time.sleep(1)
    # ⚠️ LE PREMIER CLIC NE COMPTE PAS. macOS le consomme pour donner le focus a
    # la fenetre : le bouton vise ne le recoit jamais. Les cinq premieres
    # captures montraient toutes le meme ecran, chaque geste arrivant avec un
    # coup de retard. On brule donc un clic sur une zone morte — le texte de
    # presentation, qui ne repond a rien — avant de commencer.
    controler_fenetre()
    clic(0.5, 0.30)
    time.sleep(0.5)

    """Le parcours. Chaque etape : (ce qu'on clique, ce qu'on photographie).
       Un clic a None veut dire « ne touche a rien, regarde ».

       ⚠️ UN PLATEAU VIDE NE DONNE ENVIE A PERSONNE. Les premieres captures
       montraient l'arene juste apres la mise : deux grilles vides et un
       gobelet. On joue donc une poignee de tours AVANT de photographier — ce
       qu'on vend est la partie, pas l'ecran de depart."""
    LANCER = (0.50, 0.955)
    CALE   = (0.16, 0.955)
    COLONNES = [(0.27, 0.75), (0.50, 0.75), (0.73, 0.75)]
    ONGLETS = {"boutique": (0.45, 0.082), "classement": (0.61, 0.082),
               "regles": (0.78, 0.082)}
    FERMER = (0.92, 0.082)

    # ⚠️ L'APPLICATION REPREND LA PARTIE EN COURS AU LANCEMENT, et c'est une
    # qualite du jeu — mais elle privait les captures de l'ecran d'accueil : la
    # premiere photo montrait deja une arene. On abandonne donc toute partie qui
    # traine avant de commencer. Sur le pont, ces deux gestes ne rencontrent
    # rien : le premier tombe dans les statistiques, le second dans le vide.
    QUITTER = (0.84, 0.950)
    # ⚠️ CES DEUX POSITIONS SONT MESUREES, PAS DEVINEES. La carte d'abandon
    # s'ouvre HAUT dans l'ecran, la carte de fin de partie au MILIEU : viser le
    # milieu pour les deux ratait la premiere, la partie continuait toute seule
    # et les sept captures montraient la meme defaite.
    ABANDON_OUI = (0.712, 0.249)
    FIN_LE_PONT = (0.666, 0.548)
    parcours = [
        (FIN_LE_PONT,   None),              # au cas ou une carte de fin traine
        (QUITTER,       None),
        (ABANDON_OUI,   None),              # confirmer l'abandon
        (None,          "1_menu"),          # le pont, et ses cinq capitaines
        ((0.50, 0.65),  None),              # affronter l'IA
        (None,          "2_mise"),          # la carte de mise
        ((0.62, 0.465), None),              # miser 50
        ((0.50, 0.645), None),              # bloquer la mise
    ]
    # Six tours : lancer, poser. Les colonnes tournent pour que le plateau se
    # remplisse en largeur plutot que de creuser une seule pile.
    for tour in range(6):
        parcours.append((LANCER, None))
        parcours.append((COLONNES[tour % 3], None))
    parcours += [
        (None,          "3_plateau"),       # l'arene, des poses des deux cotes
        (CALE,          None),              # ouvrir la cale
        (None,          "4_cale"),          # l'eventail des effets
        (CALE,          None),              # la refermer
        (ONGLETS["boutique"],   None),
        (None,          "5_boutique"),      # les parures et les effets en vente
        (FERMER,        None),
        (ONGLETS["classement"], None),
        (None,          "6_classement"),    # le livre de bord
        (FERMER,        None),
        (ONGLETS["regles"],     None),
        (None,          "7_regles"),        # les regles de la table
        (FERMER,        None),
    ]

    for geste, nom in parcours:
        if geste:
            clic(*geste)
        time.sleep(args.attente)
        if nom:
            photo(os.path.join(args.sortie, nom + ".png"))


if __name__ == "__main__":
    main()
