#!/usr/bin/env python3
"""
outils/orienter_des.py — REMETTRE LES DES D'ORIGINE DANS LE SENS DES PARURES.

    python3 outils/orienter_des.py --sens horaire      # ce qui a ete demande
    python3 outils/orienter_des.py --sens miroir       # meme resultat, lumiere gardee
    python3 outils/orienter_des.py --sens anti         # l'autre quart de tour

⛔ LES DES D'ORIGINE N'ETAIENT PAS DANS LE MEME SENS QUE LES PARURES, et c'est
mesurable : les deux points du 2 et les trois du 3 descendent de gauche a droite
sur les des d'origine (diagonale « \\ »), et MONTENT sur toutes les parures
(diagonale « / »). Mesure des centres :

    origine  die_2 (79,79) (172,165)     \\
    S002     die_2 (89,161) (170,88)     /
    S006     die_2 (89,160) (169,88)     /

Un quart de tour suffit a les accorder — c'est la demande.

⚠️ MAIS UN QUART DE TOUR EMPORTE AUSSI LA LUMIERE. Ces des sont eclaires du
haut : reflet en haut, degrade chaud en bas. Mesure du centre des pixels
satures, en fraction de la hauteur (0 = en haut) :

    reference S006          y=0,57  x=0,52
    origine                 y=0,67  x=0,54
    quart de tour horaire   y=0,54  x=0,33   ← le degrade part sur le cote
    quart de tour anti      y=0,45  x=0,67   ← idem, de l'autre cote
    miroir horizontal       y=0,67  x=0,45   ← la lumiere reste en haut

Le miroir donne la MEME diagonale que les parures sans deplacer la lumiere.
L'option existe donc ici, a une commande d'ecart ; le sens par defaut reste
celui qui a ete demande.

⚠️ ET IL FAUT REGRAVER APRES. Les motifs sont graves dans les faces
(outils/motifs.py) : tourner les faces sans regraver laisserait les gravures du
jeu d'origine dans l'ancien sens.
"""
import argparse
import os
import sys

from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DOSSIER = os.path.join(RACINE, "www", "dice", "img")

# ⚠️ `die_unknown` NE TOURNE PAS : c'est un point d'interrogation, pas une face.
# Une lettre couchee ne se lit plus, et elle n'a pas de diagonale a accorder.
FACES = ["die_%d%s.png" % (n, s) for n in range(1, 7) for s in ("", "_hot")]

SENS = {
    "horaire": lambda im: im.rotate(-90, resample=Image.BICUBIC, expand=False),
    "anti": lambda im: im.rotate(90, resample=Image.BICUBIC, expand=False),
    "miroir": lambda im: im.transpose(Image.FLIP_LEFT_RIGHT),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sens", choices=sorted(SENS), default="horaire")
    ap.add_argument("--source", default=None,
                    help="dossier de depart (defaut : les faces en place)")
    args = ap.parse_args()

    tourner = SENS[args.sens]
    source = args.source or DOSSIER
    faits = 0
    for nom in FACES:
        chemin = os.path.join(source, nom)
        if not os.path.isfile(chemin):
            print("  ✖ absent : " + nom)
            continue
        im = Image.open(chemin).convert("RGBA")
        tourner(im).save(os.path.join(DOSSIER, nom))
        faits += 1
    print("%d faces reorientees (%s)" % (faits, args.sens))
    print("⚠️ pense a regraver les motifs : python3 outils/motifs.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
