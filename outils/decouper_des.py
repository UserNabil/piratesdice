#!/usr/bin/env python3
"""
outils/decouper_des.py — une planche 4x3 devient douze faces mesurees.

    python3 outils/decouper_des.py <planche.png> <S00X> [--nom lagon]

⚠️ LA BOITE ALPHA BRUTE MENT. Les planches arrivent avec un halo blanc et une
ombre portee dont l'alpha n'est pas nul : se caler dessus decentre le de d'une
dizaine de pixels, et le joueur voit ses des flotter dans leur logement. On ne
retient donc que le CORPS — alpha >= 200 — et c'est lui qu'on recentre.

⚠️ L'ARRONDI EST CE QUI COMPTE LE PLUS. Le jeu creuse un logement dont les coins
se calculent a partir du pourcentage releve ici. Trop carre, le de laisse quatre
angles vides ; trop rond, il flotte. On le mesure sur les quatre coins de chaque
face et on prend la mediane : un coin abime par le halo ne doit pas decider seul.
"""
import json
import os
import statistics
import sys

from PIL import Image

COTE = 256
COLONNES, LIGNES = 3, 4
OPAQUE = 200
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def corps(im):
    """La boite du corps opaque, halo exclu."""
    alpha = im.getchannel("A")
    masque = alpha.point(lambda a: 255 if a >= OPAQUE else 0)
    boite = masque.getbbox()
    if not boite:
        raise SystemExit("une tuile est vide : la decoupe ne tombe pas juste")
    return masque, boite


def rayon(masque, boite):
    """L'arrondi peint, en pixels, mediane des quatre coins.

    Sur un carre arrondi, la premiere ligne pleine commence a `r` du bord : on
    lit donc, dans la ligne du haut de la boite, ou le corps commence vraiment.
    """
    g, h, d, b = boite
    px = masque.load()
    mesures = []
    for ligne, sens in ((h, +1), (b - 1, +1)):
        for depart, pas in ((g, +1), (d - 1, -1)):
            x = depart
            while 0 <= x < masque.width and px[x, ligne] == 0:
                x += pas
            mesures.append(abs(x - depart) * 1.0)
    return statistics.median(mesures)


def decouper(planche, code, nom):
    src = Image.open(planche).convert("RGBA")
    tuile_l = src.width // COLONNES
    tuile_h = src.height // LIGNES
    sortie = os.path.join(RACINE, "www", "dice", "img", "skins", code)
    os.makedirs(sortie, exist_ok=True)

    rayons, parts, largeurs, hauteurs = [], [], [], []
    for index in range(COLONNES * LIGNES):
        ligne, colonne = divmod(index, COLONNES)
        tuile = src.crop((colonne * tuile_l, ligne * tuile_h,
                          (colonne + 1) * tuile_l, (ligne + 1) * tuile_h))
        tuile = tuile.resize((COTE, COTE), Image.LANCZOS)

        masque, boite = corps(tuile)
        g, h, d, b = boite
        largeur, hauteur = d - g, b - h
        # Recentrer le CORPS sur (128, 128) : c'est lui que le joueur voit.
        dx = round(COTE / 2 - (g + d) / 2)
        dy = round(COTE / 2 - (h + b) / 2)
        if dx or dy:
            cale = Image.new("RGBA", (COTE, COTE), (0, 0, 0, 0))
            cale.paste(tuile, (dx, dy))
            tuile = cale
            masque, boite = corps(tuile)

        face = index % 6 + 1
        chaude = index >= 6
        tuile.save(os.path.join(sortie, "die_%d%s.png" % (face, "_hot" if chaude else "")))

        r = rayon(masque, boite)
        rayons.append(r / max(largeur, hauteur) * 100)
        parts.append(max(largeur, hauteur) / COTE)
        largeurs.append(largeur)
        hauteurs.append(hauteur)

    ecart = max(max(largeurs) - min(largeurs), max(hauteurs) - min(hauteurs))
    mesure = {
        "dossier": nom, "images": 12, "chaudes": True,
        "rayon": round(statistics.median(rayons), 1),
        "corps": round(statistics.median(parts), 3),
    }
    print("%s — corps %d x %d px, part %.3f, arrondi %.1f %%"
          % (code, statistics.median(largeurs), statistics.median(hauteurs),
             mesure["corps"], mesure["rayon"]))
    print("   ecart entre faces : %d px %s" % (ecart, "(bon)" if ecart <= 14 else "(⚠ trop)"))
    return mesure


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    planche, code = sys.argv[1], sys.argv[2]
    nom = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--nom" else code.lower()
    mesure = decouper(planche, code, nom)

    fiche = os.path.join(RACINE, "www", "dice", "img", "skins", "_mesures.json")
    tout = json.load(open(fiche, encoding="utf-8"))
    ancien = tout.get(code, {})
    mesure["dossier"] = ancien.get("dossier", nom)
    tout[code] = mesure
    with open(fiche, "w", encoding="utf-8") as f:
        json.dump(tout, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("   _mesures.json a jour")


if __name__ == "__main__":
    main()
