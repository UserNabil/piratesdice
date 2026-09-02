#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
outils/effets3.py — LES CINQ CAPITAINES DE B012 A B016, MIS AU FORMAT.

Suite directe d'`effets2.py`, et volontairement ecrit sur le meme patron : memes
formats, meme cadrage, meme mesure de remplissage. Un troisieme lot arrivera un
jour ; il aura son fichier, et la trace de ce qui a ete importe quand restera
lisible plutot que d'etre ecrasee a chaque fois.

L'art arrive dans `~/Downloads/new_effect_pirates` en toiles libres (393 a
1254 px, aucune carree). Le jeu attend quatre formats :

    cap_*.png        512 x 512   le portrait, au bandeau et sur la fiche
    trait_*.png      256 x 256   l'icone de l'effet, au ratelier et en boutique
    fx_*_case.png    320 x 320   ce qui se pose SUR UNE CASE, bord a bord
    background_*.png     libre   les fonds, qui ne se recadrent pas

⚠️ LE REMPLISSAGE, ENCORE. Les icones livrees occupent entre 70 % et 95 % de
leur toile. Posees telles quelles a cote des dix anciennes, elles paraissent
tantot plus grosses tantot plus petites alors que les boutons font la meme
taille. On recadre sur le DESSIN (la boite alpha) puis on l'inscrit a 92 % du
cote — la mesure des icones deja livrees, celle qu'`effets2.py` a etablie.

⛔ CE QUI SE POSE SUR UNE CASE NE SE CENTRE PAS : IL REMPLIT. Le givre l'a appris
le premier (`fx_gel_case.png`) et la regle vaut pour la brume et pour le
bouclier : l'image epouse le logement du de, donc elle touche ses quatre bords.
Un dessin centre avec 8 % de marge laisserait un lisere de plateau visible tout
autour de la case, et l'effet aurait l'air pose de travers.

⚠️ DEUX BRUMES, ET CE N'EST PAS UN DOUBLON. `fx_hide_player.png` est violette —
la couleur du jeu, celle qui rassure — et `fx_hide_enemi.png` est bleue et
froide. C'est le MEME brouillard sur le MEME plateau, dessine selon le cote d'ou
on le regarde : le jeu colore deja ses annonces ainsi (`f.seat === S.seat ?
'bad' : 'good'`), et le joueur sait au premier coup d'oeil si ce qu'il voit le
protege ou le gene.

⛔ CE PROGRAMME N'ECRASE RIEN. Tous ses noms de sortie sont neufs : il refuse de
tourner s'il en trouve un qui existe deja. `www/dice/img` porte du travail fait
a la main, et un outil d'import n'a aucune raison d'y toucher.

    python3 outils/effets3.py            # ecrit
    python3 outils/effets3.py --verifier # dit ce qu'il ferait, n'ecrit rien
"""

import os
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(RACINE, "www", "dice", "img")
SOURCE = os.path.expanduser("~/Downloads/new_effect_pirates")

# La part du cote qu'occupe le dessin, mesuree sur les icones deja livrees.
PART = 0.92

# Les portraits. La cle est l'identifiant serveur du capitaine (src/game/
# captains.js) ; le nom de fichier est celui que le jeu construit tout seul,
# `cap_<id>.png` — voir `captainArt` dans dice_lobby.js.
CAPITAINES = [
    ("kidd", "Captain Kidd.png"),
    ("wangzhi", "Wang Zhi.png"),
    ("levent", "Anne Levent.png"),
    ("caesar", "Black Caesar.png"),
    ("sayyida", "Sayyida al-Hurra.png"),
]

# Les icones d'effet, `trait_<id>.png` — voir `traitArt` dans dice_lobby.js et
# la table BONUS_ART de dice_state.js, qui fait pointer B012..B016 dessus.
TRAITS = [
    ("kidd", "Dé pipé.png"),
    ("wangzhi", "Brouillard de poudre.png"),
    ("levent", "Manœuvre de pont.png"),
    ("caesar", "Coque renforcée.png"),
    ("sayyida", "Changement de quart.png"),
]

# Ce qui se pose sur une case, bord a bord, comme le givre.
CASES = [
    ("fx_brume_moi.png", "fx_hide_player.png"),
    ("fx_brume_adverse.png", "fx_hide_enemi.png"),
    ("fx_bouclier_case.png", "shield.png"),
]

# Les fonds. Ils ne se recadrent pas — un fond n'a pas de sujet a centrer — mais
# ils se reduisent : 1,7 Mo de decor dans une application qui doit s'ouvrir hors
# ligne, c'est plus que tous les portraits reunis.
#
# ⚠️ ET CELUI QUI N'A PAS DE TRANSPARENCE N'A RIEN A FAIRE EN PNG. Le decor de
# la fiche capitaine est opaque de bord a bord (alpha 255 partout) : en PNG il
# pese 1 Mo, en JPEG de qualite 86 il en pese le sixieme pour une image que
# personne ne distinguera — c'est un fond derriere du texte, pas un dessin
# detoure. Les coins arrondis de la carte sont faits par le CSS, pas par
# l'image, donc rien ne depend de son canal alpha.
#
# ⚠️ CELUI DES PANNEAUX, LUI, RESTE EN PNG : son alpha ne depasse jamais 51.
# C'est une texture qu'on pose PAR-DESSUS, presque transparente ; l'aplatir sur
# du blanc en ferait un rectangle opaque qui masquerait le panneau.
FONDS = [
    ("background_cap_info.jpg", "background_cap_info.png", 1100),
    ("background_effect.png", "background_effect.png", 640),
]


def boite(im):
    """La boite du DESSIN, alpha > 8 — pas celle de la toile."""
    alpha = im.getchannel("A")
    return alpha.point(lambda v: 255 if v > 8 else 0).getbbox()


def inscrire(src, dst, cote, ecrire=True):
    """Recadrer sur le dessin, puis l'inscrire a `PART` du cote, centre."""
    im = Image.open(src).convert("RGBA")
    b = boite(im)
    if not b:
        sys.exit("DESSIN VIDE : %s" % src)
    im = im.crop(b)
    large = int(round(cote * PART))
    k = min(large / im.width, large / im.height)
    im = im.resize((max(1, int(round(im.width * k))),
                    max(1, int(round(im.height * k)))), Image.LANCZOS)
    toile = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    toile.paste(im, ((cote - im.width) // 2, (cote - im.height) // 2))
    if ecrire:
        toile.save(dst, optimize=True)
    return toile.size


def remplir(src, dst, cote, ecrire=True):
    """Recadrer sur le dessin, puis l'etirer a la toile ENTIERE."""
    im = Image.open(src).convert("RGBA")
    b = boite(im)
    if not b:
        sys.exit("DESSIN VIDE : %s" % src)
    im = im.crop(b).resize((cote, cote), Image.LANCZOS)
    if ecrire:
        im.save(dst, optimize=True)
    return im.size


def reduire(src, dst, largeur, ecrire=True):
    """Reduire un fond a `largeur`, en gardant ses proportions.

    La destination decide du format : `.jpg` pour un fond opaque, `.png` quand
    la transparence porte l'effet. Voir FONDS.
    """
    im = Image.open(src).convert("RGBA")
    if im.width > largeur:
        k = largeur / im.width
        im = im.resize((largeur, max(1, int(round(im.height * k)))), Image.LANCZOS)
    if ecrire:
        if dst.lower().endswith(".jpg"):
            im.convert("RGB").save(dst, quality=86, optimize=True, progressive=True)
        else:
            im.save(dst, optimize=True)
    return im.size


def main():
    verifier = "--verifier" in sys.argv
    if not os.path.isdir(SOURCE):
        sys.exit("ART ABSENT : %s" % SOURCE)

    # (nom de sortie, chemin source, fonction, argument)
    travaux = []
    for cle, nom in CAPITAINES:
        travaux.append(("cap_%s.png" % cle, nom, inscrire, 512))
    for cle, nom in TRAITS:
        travaux.append(("trait_%s.png" % cle, nom, inscrire, 256))
    for sortie, nom in CASES:
        travaux.append((sortie, nom, remplir, 320))
    for sortie, nom, largeur in FONDS:
        travaux.append((sortie, nom, reduire, largeur))

    # ⛔ TOUT EST VERIFIE AVANT QU'UNE SEULE IMAGE NE SOIT ECRITE. Un import qui
    # s'arrete au milieu laisse le depot dans un etat que personne n'a voulu.
    manquants = [n for _, n, _, _ in travaux if not os.path.exists(os.path.join(SOURCE, n))]
    if manquants:
        sys.exit("SOURCES ABSENTES :\n  " + "\n  ".join(manquants))
    # ⚠️ `--refaire` NE LEVE LA GARDE QUE SUR CE QUE CET OUTIL PRODUIT. La liste
    # ci-dessus est fermee : un fichier fait a la main n'y figure pas, donc il ne
    # peut pas etre ecrase, meme par megarde. Sans ce drapeau on relance l'import
    # apres un ajustement de format et il refuse — ce qui est bien la garde
    # qu'on veut par defaut, mais un outil d'import doit rester rejouable.
    deja = [s for s, _, _, _ in travaux if os.path.exists(os.path.join(IMG, s))]
    if deja and not verifier and "--refaire" not in sys.argv:
        sys.exit("CES FICHIERS EXISTENT DEJA, ON N'ECRASE PAS :\n  " + "\n  ".join(deja)
                 + "\n\n(--refaire pour les regenerer)")

    fait = []
    for sortie, nom, fn, arg in travaux:
        t = fn(os.path.join(SOURCE, nom), os.path.join(IMG, sortie), arg, not verifier)
        fait.append((sortie, "%dx%d" % t, nom))

    for sortie, taille, nom in fait:
        chemin = os.path.join(IMG, sortie)
        poids = os.path.getsize(chemin) // 1024 if os.path.exists(chemin) else 0
        print("  %-24s %-10s %5d ko   <- %s" % (sortie, taille, poids, nom))
    print("\n%d fichiers %s dans www/dice/img/"
          % (len(fait), "a ecrire" if verifier else "ecrits"))


if __name__ == "__main__":
    main()
