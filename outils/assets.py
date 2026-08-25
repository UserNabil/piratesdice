#!/usr/bin/env python3
"""
outils/assets.py — poser une image livree dans le jeu, ou decouper une planche.

    python3 outils/assets.py poser <source.png> <cible.png> [--cote 256]
    python3 outils/assets.py decouper <planche.png> <colonnes>x<lignes> \
            <cible1.png> <cible2.png> ...

⚠️ ON NE REDIMENSIONNE PAS UNE IMAGE LIVREE TELLE QUELLE. Les planches arrivent
avec une marge transparente qui varie d'un fichier a l'autre : redimensionner
sans la retirer donne des icones de tailles apparentes differentes alignees sur
la meme grille, et l'ecran parait bancal sans qu'on sache dire pourquoi. On
recadre donc sur le CONTENU, puis on repose ce contenu centre, avec une marge
egale et choisie — la meme pour toutes.

⚠️ ET LE HALO N'EST PAS DU CONTENU. Ces images portent un contour blanc et une
ombre dont l'alpha est faible mais non nul. Se caler sur `getbbox()` brut
reviendrait a cadrer sur le halo. On coupe a alpha >= 24 : assez bas pour garder
le contour dessine, assez haut pour ignorer la brume.
"""
import os
import sys

from PIL import Image

SEUIL = 24          # en dessous, c'est du halo, pas du dessin
MARGE = 0.04        # 4 % de marge, comme les des


def contenu(im):
    alpha = im.getchannel("A")
    masque = alpha.point(lambda a: 255 if a >= SEUIL else 0)
    return masque.getbbox()


def poser(source, cible, cote=256):
    im = Image.open(source).convert("RGBA")
    boite = contenu(im)
    if not boite:
        raise SystemExit("image vide : " + source)
    im = im.crop(boite)

    utile = round(cote * (1 - 2 * MARGE))
    ratio = min(utile / im.width, utile / im.height)
    im = im.resize((max(1, round(im.width * ratio)), max(1, round(im.height * ratio))),
                   Image.LANCZOS)

    toile = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    toile.paste(im, ((cote - im.width) // 2, (cote - im.height) // 2))
    os.makedirs(os.path.dirname(cible) or ".", exist_ok=True)
    toile.save(cible, optimize=True)
    print("  %-34s %d x %d" % (os.path.basename(cible), cote, cote))


def decouper(planche, grille, cibles, cote=256):
    colonnes, lignes = (int(n) for n in grille.lower().split("x"))
    if len(cibles) != colonnes * lignes:
        raise SystemExit("%d cases dans la grille, %d cibles donnees"
                         % (colonnes * lignes, len(cibles)))
    src = Image.open(planche).convert("RGBA")
    lc, lh = src.width // colonnes, src.height // lignes
    for index, cible in enumerate(cibles):
        ligne, colonne = divmod(index, colonnes)
        case = src.crop((colonne * lc, ligne * lh, (colonne + 1) * lc, (ligne + 1) * lh))
        temporaire = case
        boite = contenu(temporaire)
        if not boite:
            print("  %-34s VIDE, ignoree" % os.path.basename(cible))
            continue
        tampon = "/tmp/_case.png"
        temporaire.save(tampon)
        poser(tampon, cible, cote)


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    verbe = sys.argv[1]
    if verbe == "poser":
        cote = 256
        args = sys.argv[2:]
        if "--cote" in args:
            i = args.index("--cote")
            cote = int(args[i + 1])
            args = args[:i] + args[i + 2:]
        poser(args[0], args[1], cote)
    elif verbe == "decouper":
        args = sys.argv[2:]
        cote = 256
        if "--cote" in args:
            i = args.index("--cote")
            cote = int(args[i + 1])
            args = args[:i] + args[i + 2:]
        decouper(args[0], args[1], args[2:], cote)
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
