#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
outils/effets2.py — LES CINQ NOUVEAUX CAPITAINES ET LEURS EFFETS, MIS AU FORMAT.

L'art arrive de `~/Downloads` en toiles de tailles libres (488 a 1254 px, jamais
carrees). Le jeu, lui, attend trois formats et un seul cadrage :

    cap_*.png      512 x 512   le portrait, choisi au debut de partie
    trait_*.png    256 x 256   l'icone de l'effet, au ratelier et en boutique
    fx_gel_case    320 x 320   le givre POSE SUR UNE CASE

⚠️ LE REMPLISSAGE N'EST PAS UN DETAIL. Les icones livrees occupent entre 68 % et
94 % de leur toile ; posees telles quelles a cote des anciennes, les nouvelles
paraissaient tantot plus grosses tantot plus petites alors que les boutons font
la meme taille. On recadre donc sur le DESSIN (la boite alpha), puis on l'inscrit
a 92 % du cote — la mesure des icones deja livrees.

⛔ LE GIVRE, LUI, NE SE CENTRE PAS : IL REMPLIT. C'est le seul dessin de tout le
jeu qui doit toucher ses quatre bords, puisqu'il se pose exactement sur une case
et que l'admin l'a demande ainsi — « l'image suit la taille du slot du de ». On
l'etire donc a la toile entiere, sans marge : 1208 x 1175 de dessin utile pour
une toile carree, l'ecart de 2,7 % ne se voit pas et l'ecart de cadrage, lui,
se verrait tout de suite.
"""

import os
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RACINE, "www", "dice", "img")
TELECHARGE = os.path.expanduser("~/Downloads")
ICONES = os.path.join(TELECHARGE, "icones_pirate")
PORTRAITS = os.path.join(TELECHARGE, "new_captains")

# La part du cote qu'occupe le dessin, mesuree sur les icones deja livrees.
PART = 0.92

# ⚠️ UN DESSIN DEUX FOIS PLUS HAUT QUE LARGE NE SE TRAITE PAS COMME LES AUTRES.
# La colonne maudite fait 612 x 1206 — un rapport de 0,51 la ou les quatre autres
# icones tournent autour de 1. Inscrite a 92 % comme elles, elle n'occupait que
# 47 % de la largeur de sa toile : posee au ratelier a cote de jetons qui la
# remplissent, elle paraissait deux fois plus petite alors que les boutons font
# la meme taille. On lui donne donc TOUTE la hauteur. Elle reste etroite — c'est
# une colonne, et cela se lit ainsi — mais elle pese enfin autant que ses
# voisines sur l'axe que l'oeil compare en premier.
PART_PAR_FICHIER = {'column_cursed.png': 1.0}

# Les portraits. La cle est l'identifiant serveur du capitaine.
CAPITAINES = [
    ("bonny", "Anne Bonny.png"),
    ("bart", "Black Bart.png"),
    ("lionne", "La Lionne Sanglante.png"),
    ("morgan", "Henry Morgan.png"),
    ("levasseur", "Olivier Levasseur.png"),
]

# Les icones d'effet. Meme cle : `trait_<capitaine>.png` est le nom que le jeu
# construit tout seul depuis l'identifiant (voir `artTrait` dans dice_lobby.js).
TRAITS = [
    ("bonny", "slow_time.png"),
    ("bart", "swip_dice.png"),
    ("morgan", "jump_turn.png"),
    ("levasseur", "column_cursed.png"),
    # ⚠️ CHING SHIH CHANGE DE TRAIT, DONC D'ICONE. La longue-vue passe a la
    # Lionne Sanglante — c'est elle qui la tient sur son portrait — et Ching Shih
    # recoit le canon qui rase une colonne.
    ("ching", "destroy_entire_columns.png"),
]


def boite(im):
    """La boite du DESSIN, alpha > 8 — pas celle de la toile."""
    alpha = im.getchannel("A")
    return alpha.point(lambda v: 255 if v > 8 else 0).getbbox()


def inscrire(src, dst, cote):
    """Recadrer sur le dessin, puis l'inscrire a `PART` du cote, centre."""
    im = Image.open(src).convert("RGBA")
    b = boite(im)
    if not b:
        sys.exit("DESSIN VIDE : %s" % src)
    im = im.crop(b)
    part = PART_PAR_FICHIER.get(os.path.basename(src), PART)
    large = int(round(cote * part))
    k = min(large / im.width, large / im.height)
    im = im.resize((max(1, int(round(im.width * k))),
                    max(1, int(round(im.height * k)))), Image.LANCZOS)
    toile = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    toile.paste(im, ((cote - im.width) // 2, (cote - im.height) // 2))
    toile.save(dst, optimize=True)
    return toile.size


def remplir(src, dst, cote):
    """Recadrer sur le dessin, puis l'etirer a la toile ENTIERE."""
    im = Image.open(src).convert("RGBA")
    b = boite(im)
    if not b:
        sys.exit("DESSIN VIDE : %s" % src)
    im = im.crop(b).resize((cote, cote), Image.LANCZOS)
    im.save(dst, optimize=True)
    return im.size


def main():
    if not os.path.isdir(ICONES) or not os.path.isdir(PORTRAITS):
        sys.exit("ART ABSENT : %s ou %s" % (ICONES, PORTRAITS))

    fait = []

    # ⚠️ LA COPIE AVANT L'ECRASEMENT. `trait_ching.png` EST la longue-vue
    # d'aujourd'hui ; elle doit devenir `trait_lionne.png` AVANT que le canon ne
    # prenne sa place, sinon le dessin est perdu et il n'existe nulle part
    # ailleurs.
    oeil = os.path.join(IMG, "trait_ching.png")
    lionne = os.path.join(IMG, "trait_lionne.png")
    if os.path.exists(oeil) and not os.path.exists(lionne):
        Image.open(oeil).convert("RGBA").save(lionne, optimize=True)
        fait.append(("trait_lionne.png", "256x256", "l'oeil, herite de Ching Shih"))

    for cle, nom in CAPITAINES:
        dst = os.path.join(IMG, "cap_%s.png" % cle)
        t = inscrire(os.path.join(PORTRAITS, nom), dst, 512)
        fait.append(("cap_%s.png" % cle, "%dx%d" % t, nom))

    for cle, nom in TRAITS:
        dst = os.path.join(IMG, "trait_%s.png" % cle)
        t = inscrire(os.path.join(ICONES, nom), dst, 256)
        fait.append(("trait_%s.png" % cle, "%dx%d" % t, nom))

    gel = os.path.join(TELECHARGE, "gele_slot.png")
    if os.path.exists(gel):
        dst = os.path.join(IMG, "fx_gel_case.png")
        t = remplir(gel, dst, 320)
        fait.append(("fx_gel_case.png", "%dx%d" % t, "gele_slot.png, etire bord a bord"))

    for nom, taille, source in fait:
        poids = os.path.getsize(os.path.join(IMG, nom)) // 1024
        print("  %-22s %-9s %4d ko   <- %s" % (nom, taille, poids, source))
    print("\n%d fichiers ecrits dans www/dice/img/" % len(fait))


if __name__ == "__main__":
    main()
