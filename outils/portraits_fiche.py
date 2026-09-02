#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
outils/portraits_fiche.py — LE PORTRAIT DE LA FICHE, SANS SON LISERE.

⛔ `cap_<id>.png` EST UN AUTOCOLLANT, ET LA FICHE N'EN VEUT PAS. Le contour blanc
epais qui entoure chaque capitaine est fait pour le MEDAILLON du bandeau : sur un
petit rond sombre, il detache le visage et lui donne son relief. Sur la fiche, il
fait exactement l'inverse — le personnage est colle par-dessus le decor au lieu
d'y entrer, et la maquette (`maquette_info_cap.png`) ne montre aucun lisere.

⛔ ET AUCUN MASQUE CSS NE PEUT L'ENLEVER. Un masque agit sur le CADRE de l'image ;
le lisere, lui, epouse la silhouette. On peut estomper les bords du rectangle
autant qu'on veut, le trait blanc reste la ou le personnage se trouve. Essaye, et
verifie a l'ecran : le fondu marchait en bas a droite, le contour du chapeau
restait net.

La seule reponse est de retirer le lisere DE L'IMAGE. Il occupe une bande de
largeur a peu pres constante autour du sujet : eroder le canal alpha de cette
largeur l'emporte, et rien d'autre. Puis un flou leger sur l'alpha rend le bord
tendre, pour que le personnage se fonde au lieu d'etre decoupe.

⚠️ LE RAYON A ETE MESURE, PAS DEVINE. Planche de comparaison a 9, 13, 17 et
21 px sur fond violet : a 9 il reste un fil blanc au bord du chapeau ; a 17 et
21 les pointes des plumes commencent a fondre. 13 retire le lisere entier et ne
touche pas au dessin.

⛔ CE PROGRAMME N'ECRASE JAMAIS `cap_*.png`. Il ECRIT A COTE, sous `capf_<id>`
(« capitaine, fiche ») : le medaillon du bandeau continue d'utiliser
l'autocollant, qui reste le bon dessin pour lui. Deux usages, deux images, une
seule source.

    python3 outils/portraits_fiche.py            # ecrit
    python3 outils/portraits_fiche.py --verifier # dit ce qu'il ferait
"""

import os
import sys

from PIL import Image, ImageChops, ImageFilter

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RACINE, "www", "dice", "img")

# L'ordre est celui du deverrouillage, comme partout ailleurs.
CAPITAINES = ["read", "jack", "ching", "teach", "omalley",
              "bonny", "bart", "lionne", "morgan", "levasseur",
              "kidd", "wangzhi", "levent", "caesar", "sayyida"]

# ⛔ ERODER LA SILHOUETTE NE SUFFISAIT PAS, ET C'EST INSTRUCTIF. Un premier jet
# reculait le bord de l'alpha de 13 px : le lisere exterieur partait, mais celui
# qui court ENTRE LES MECHES DE CHEVEUX restait — une erosion travaille sur le
# contour de la forme, pas sur ce qui est enclave dedans. Resultat a l'ecran :
# des trainees blanches dans la chevelure, plus laides que le lisere d'origine.
# Pousser l'erosion plus loin mangeait les pointes des plumes sans rien y faire.
#
# On retire donc le lisere par SA COULEUR, pas par sa position : il est d'un
# blanc pur et desature, la ou la chemise et les plumes sont cremes et ombrees.
# Deux conditions, et les deux comptent :
#   — etre blanc au-dela du seuil ;
#   — se trouver a moins de PORTEE du vide, donc appartenir au bord.
# La seconde protege la chemise et le col, qui sont clairs mais au coeur du
# dessin.

# Jusqu'ou chercher le lisere depuis le vide, en pixels sur une toile de 512.
PORTEE = 18
# A partir de quelle valeur du canal le plus sombre un pixel est « blanc ».
BLANCHEUR = 198
# Un dernier rognage, apres le retrait par la couleur : il emporte les quelques
# pixels gris-clair que le seuil a laisses et qui formaient encore un halo.
ROGNAGE = 5
# Le flou pose sur l'alpha. Il reste FAIBLE — a 2 px il etalait ce qui restait de
# clair et rendait justement le halo qu'on cherche a supprimer.
DOUCEUR = 1.0

# ⛔ LE FONDU EST CUIT DANS L'IMAGE, ET C'EST UN CHOIX MOTIVE. Il a d'abord ete
# tente en CSS, avec `mask-image`. Deux echecs, tous deux mesures :
#   1. deux masques lineaires composes — WebKit retient l'union des couches, le
#      fondu ne se voyait pas du tout ;
#   2. un degrade radial sur la boite de l'image — le portrait est inscrit a
#      92 % de sa toile, donc la zone de fondu du masque tombait dans la marge
#      TRANSPARENTE et n'effacait rien. Au bord droit, le masque ne descendait
#      qu'a 70 % d'opacite : invisible.
# Cuit dans l'alpha, le fondu porte sur le DESSIN lui-meme, il est identique
# partout, et il ne depend d'aucune particularite de moteur.
#
# Les quatre bords n'ont pas le meme role : a gauche le portrait touche le bord
# de la carte, en haut il garde ses plumes, a droite il rencontre le texte, en
# bas le panneau du bonus. D'ou quatre reglages.
# ⛔ ET LE FONDU DOIT ETRE FRANC. Un premier reglage ne faisait que l'effleurer :
# a gauche il ne descendait qu'a 45 % d'opacite, si bien que le portrait
# recouvrait encore le lisere creme de la carte. « On doit voir le cadre de la
# modal » — donc les bords vont VRAIMENT jusqu'a zero, et la fenetre de fondu est
# large. Seul le haut garde un fond d'opacite : les plumes doivent rester
# lisibles, c'est « un peu en haut », pas « efface en haut ».
# ⚠️ ET CES FENETRES SONT LARGES PARCE QUE L'IMAGE EST GRANDE. Les deux vont
# ensemble : agrandir le portrait sans elargir le fondu le ferait deborder en
# dur sur le texte et sur le cadre. Ce qu'on veut, c'est un personnage PLUS
# GRAND dont il ne reste net que le coeur — le visage et le chapeau — le reste
# se dissolvant dans la carte. La moitie droite de l'image est desormais en
# fondu, et un bon tiers du bas.
FONDU = {
    "bas": 0.42,        # il rencontre le panneau du bonus
    "droite": 0.50,     # il rencontre le texte
    "gauche": 0.28,     # jusqu'a zero : c'est la que le cadre reapparait
    "haut": 0.18,       # « un peu en haut »
    "plancher_haut": 0.10,
}


def rampe(w, h):
    """Le dégradé d'opacité pose sur l'alpha. Voir FONDU."""
    m = Image.new("L", (w, h), 255)
    px = m.load()
    for y in range(h):
        ry = y / (h - 1)
        fy = 1.0
        if ry > FONDU["bas"]:
            fy = 1.0 - (ry - FONDU["bas"]) / (1.0 - FONDU["bas"])
        if ry < FONDU["haut"]:
            fy = min(fy, FONDU["plancher_haut"]
                     + (1 - FONDU["plancher_haut"]) * (ry / FONDU["haut"]))
        for x in range(w):
            rx = x / (w - 1)
            f = fy
            if rx > FONDU["droite"]:
                f *= 1.0 - (rx - FONDU["droite"]) / (1.0 - FONDU["droite"])
            if rx < FONDU["gauche"]:
                # Jusqu'a ZERO au bord : sans cela le portrait masque le lisere.
                f *= rx / FONDU["gauche"]
            px[x, y] = int(max(0.0, min(1.0, f)) * 255)
    return m


def sans_lisere(source, cible, ecrire=True):
    im = Image.open(source).convert("RGBA")
    r, g, b, a = im.split()
    dehors = a.point(lambda v: 255 if v <= 8 else 0)
    proche = dehors.filter(ImageFilter.MaxFilter(PORTEE * 2 + 1))
    # Le canal le plus sombre : un blanc pur y est haut, une couleur non.
    mini = ImageChops.darker(ImageChops.darker(r, g), b)
    blanc = mini.point(lambda v: 255 if v >= BLANCHEUR else 0)
    neuf = ImageChops.subtract(a, ImageChops.multiply(proche, blanc))
    neuf = neuf.filter(ImageFilter.MinFilter(ROGNAGE))
    neuf = neuf.filter(ImageFilter.GaussianBlur(DOUCEUR))
    im.putalpha(ImageChops.multiply(neuf, rampe(im.width, im.height)))
    if ecrire:
        im.save(cible, optimize=True)
    return im.size


def main():
    verifier = "--verifier" in sys.argv
    manquants = [c for c in CAPITAINES
                 if not os.path.exists(os.path.join(IMG, "cap_%s.png" % c))]
    if manquants:
        sys.exit("PORTRAITS ABSENTS : " + ", ".join(manquants))

    for cle in CAPITAINES:
        src = os.path.join(IMG, "cap_%s.png" % cle)
        dst = os.path.join(IMG, "capf_%s.png" % cle)
        t = sans_lisere(src, dst, not verifier)
        poids = os.path.getsize(dst) // 1024 if os.path.exists(dst) else 0
        print("  capf_%-12s %dx%d %5d ko   <- cap_%s.png" % (cle + ".png", t[0], t[1], poids, cle))
    print("\n%d portraits de fiche %s dans www/dice/img/"
          % (len(CAPITAINES), "a ecrire" if verifier else "ecrits"))


if __name__ == "__main__":
    main()
