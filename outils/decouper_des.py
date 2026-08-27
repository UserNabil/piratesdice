#!/usr/bin/env python3
"""
outils/decouper_des.py — une planche 4x3 devient douze faces mesurees.

    python3 outils/decouper_des.py <planche.png> <S00X> [--nom lagon]

⚠️ LA BOITE ALPHA BRUTE MENT. Les planches arrivent avec un halo blanc et une
ombre portee dont l'alpha n'est pas nul : se caler dessus decentre le de d'une
dizaine de pixels, et le joueur voit ses des flotter dans leur logement. On ne
retient donc que le CORPS — alpha >= 200 — et c'est lui qu'on recentre.

⛔ LA GRILLE REGULIERE A LIVRE DES DES AVEC UN MORCEAU DU VOISIN. Elle
divisait la planche en douze rectangles egaux — ce qui suppose des marges
identiques et un espacement parfait. Mesure des trois planches livrees le
2026-08-27 : sur « gris », la rangee du bas commence a y=356 alors que la tuile
du haut va jusqu'a 362 ; six pixels de l'autre de entraient donc dans la face,
et le recentrage du corps les prenait pour une partie du dessin. « Je vois la
partie de l'autre dé sur la même face. »

On ne devine plus la grille : on TROUVE les des. Chaque de est une forme
opaque isolee ; on les etiquette, on garde les douze plus grandes, on les range
par rangee puis par colonne, et chacune est decoupee sur SA propre boite. Ce qui
appartient a un voisin est efface avant l'ecriture — y compris son halo.

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


def trouver_les_des(src, combien=COLONNES * LIGNES):
    """Les douze des d'une planche, ranges comme on les lit.

    ⚠️ ON ETIQUETTE LE CORPS, PAS LE HALO. Deux des voisins ont des halos qui se
    touchent : etiquetes ensemble, ils ne feraient qu'une seule forme. Le corps
    opaque, lui, est franchement separe.
    """
    import numpy as np
    from scipy import ndimage

    alpha = np.array(src.getchannel("A"))
    corps_masque = alpha >= OPAQUE
    etiquettes, combien_trouve = ndimage.label(corps_masque)
    if combien_trouve < combien:
        raise SystemExit("planche illisible : %d formes trouvees, %d attendues"
                         % (combien_trouve, combien))
    tailles = ndimage.sum(corps_masque, etiquettes, range(1, combien_trouve + 1))
    ordre = sorted(range(1, combien_trouve + 1), key=lambda i: -tailles[i - 1])[:combien]

    boites = []
    for ident in ordre:
        ys, xs = np.nonzero(etiquettes == ident)
        boites.append({"id": ident, "g": int(xs.min()), "h": int(ys.min()),
                       "d": int(xs.max()) + 1, "b": int(ys.max()) + 1})

    # Ranger par RANGEE puis par colonne : on regroupe sur le centre vertical,
    # avec une tolerance qui vaut la moitie d'un de.
    hauteur = statistics.median(b["b"] - b["h"] for b in boites)
    boites.sort(key=lambda b: (b["h"] + b["b"]) / 2)
    rangees, courante = [], [boites[0]]
    for boite in boites[1:]:
        centre = (boite["h"] + boite["b"]) / 2
        ref = (courante[0]["h"] + courante[0]["b"]) / 2
        if abs(centre - ref) < hauteur * 0.5:
            courante.append(boite)
        else:
            rangees.append(courante)
            courante = [boite]
    rangees.append(courante)
    ordonnees = []
    for rangee in rangees:
        rangee.sort(key=lambda b: b["g"])
        ordonnees.extend(rangee)
    return etiquettes, ordonnees


def proprietaires(etiquettes):
    """A quel de appartient CHAQUE pixel de la planche.

    ⛔ UNE SIMPLE DILATATION NE SUFFIT PAS, ET ON L'A PAYE DEUX FOIS. Garder ce
    qui est « a moins de quatorze pixels de mon corps » reprend aussi le corps
    du voisin quand il passe a moins de quatorze pixels : mesure apres coup, il
    restait une bande de 125 x 4 px du de d'en dessous, et un filet vertical de
    celui de droite. Un de « presque » isole est un de mal decoupe.

    On partage donc la planche ENTIERE : chaque pixel va au corps le plus
    proche, halo compris. Deux des voisins ne peuvent alors plus se disputer un
    seul pixel — la frontiere passe a mi-chemin, la ou il n'y a rien a prendre.
    """
    import numpy as np
    from scipy import ndimage

    vide = etiquettes == 0
    _, indices = ndimage.distance_transform_edt(vide, return_indices=True)
    return etiquettes[tuple(indices)]


def isoler(src, etiquettes, proprio, boite, marge=14):
    """Un de seul, sur fond transparent — le voisin efface, halo compris."""
    import numpy as np

    a = np.array(src)
    a[..., 3] = np.where(proprio == boite["id"], a[..., 3], 0)

    g = max(0, boite["g"] - marge)
    h = max(0, boite["h"] - marge)
    d = min(src.width, boite["d"] + marge)
    b = min(src.height, boite["b"] + marge)
    return Image.fromarray(a[h:b, g:d])


def epousseter(tuile, seuil=0.002):
    """Effacer les poussieres : quelques pixels du voisin, restes du partage.

    ⚠️ ET ON EPOUSSETTE APRES LA MISE A L'ECHELLE, PAS AVANT. Le
    reechantillonnage de Lanczos depasse aux transitions franches : un bord de
    halo a 199 d'opacite ressort a plus de 200 apres agrandissement, et cree la
    poussiere qu'on venait d'enlever. Mesure : sept pixels revenus sur
    `S010/die_6_hot` alors que la tuile en sortait propre.

    ⚠️ CE N'EST PAS LE MEME DEFAUT QUE LA BANDE DE 125 PIXELS. La frontiere
    entre deux des passe a mi-chemin ; quand leurs halos se touchent presque, il
    reste parfois une ou deux dizaines de pixels de l'autre cote, au ras du bord
    — sept pixels sur `S010/die_6_hot`. Invisible a l'oeil, mais c'est ce qui
    fait dire au controle « deux formes », et un controle qu'on apprend a
    ignorer ne sert plus a rien. On efface donc tout ce qui n'est pas le de :
    au-dela de 0,2 % de sa surface, on REFUSE plutot que d'effacer — ce
    serait alors un vrai morceau de voisin, et il faut le voir.
    """
    import numpy as np
    from scipy import ndimage

    a = np.array(tuile)
    m = a[..., 3] >= OPAQUE
    lab, n = ndimage.label(m)
    if n <= 1:
        return tuile
    tailles = ndimage.sum(m, lab, range(1, n + 1))
    principal = int(np.argmax(tailles)) + 1
    for ident in range(1, n + 1):
        if ident == principal:
            continue
        if tailles[ident - 1] > tailles[principal - 1] * seuil:
            raise SystemExit("un morceau de voisin de %d px est reste : la decoupe est fausse"
                             % tailles[ident - 1])
        a[..., 3] = np.where(lab == ident, 0, a[..., 3])
    return Image.fromarray(a)


def poser_a_l_echelle(tuile, part=0.926):
    """Le corps a la taille de la maison, centre sur la toile.

    ⚠️ TOUS NOS JEUX DOIVENT REMPLIR LEUR LOGEMENT DE LA MEME FACON. Les
    planches arrivent avec des corps de 0,91 a 0,99 de leur toile : posees
    telles quelles, deux parures ne font pas la meme taille dans la meme case.
    """
    masque, boite = corps(tuile)
    g, h, d, b = boite
    cote = max(d - g, b - h)
    k = (part * COTE) / cote
    grand = tuile.resize((max(1, round(tuile.width * k)), max(1, round(tuile.height * k))),
                         Image.LANCZOS)
    _, (g2, h2, d2, b2) = corps(grand)
    toile = Image.new("RGBA", (COTE, COTE), (0, 0, 0, 0))
    toile.paste(grand, (round(COTE / 2 - (g2 + d2) / 2), round(COTE / 2 - (h2 + b2) / 2)), grand)
    return toile


def decouper(planche, code, nom):
    src = Image.open(planche).convert("RGBA")
    etiquettes, boites = trouver_les_des(src)
    proprio = proprietaires(etiquettes)
    sortie = os.path.join(RACINE, "www", "dice", "img", "skins", code)
    os.makedirs(sortie, exist_ok=True)

    rayons, parts, largeurs, hauteurs = [], [], [], []
    for index, boite in enumerate(boites):
        # On epoussette APRES la mise a l'echelle : voir `epousseter`.
        tuile = epousseter(poser_a_l_echelle(isoler(src, etiquettes, proprio, boite)))
        masque, mesure_boite = corps(tuile)
        g, h, d, b = mesure_boite
        largeur, hauteur = d - g, b - h

        face = index % 6 + 1
        chaude = index >= 6
        tuile.save(os.path.join(sortie, "die_%d%s.png" % (face, "_hot" if chaude else "")))

        rayons.append(rayon(masque, mesure_boite) / max(largeur, hauteur) * 100)
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
    seuls = verifier(sortie)
    print("   %s" % seuls)
    return mesure


def verifier(dossier):
    """Chaque face ne porte-t-elle qu'UN SEUL de ?

    ⛔ C'EST LE CONTROLE QUI MANQUAIT. L'outil annoncait « douze faces » et deux
    d'entre elles portaient un morceau du de voisin : rien ne le disait, et ça
    s'est vu sur la boutique, en production.
    """
    import numpy as np
    from scipy import ndimage

    fautes = []
    for nom in sorted(os.listdir(dossier)):
        if not nom.endswith(".png"):
            continue
        a = np.array(Image.open(os.path.join(dossier, nom)).convert("RGBA"))
        m = a[..., 3] >= OPAQUE
        _, n = ndimage.label(m)
        if n != 1:
            fautes.append("%s (%d formes)" % (nom, n))
    if fautes:
        return "⚠ faces avec un morceau de voisin : " + ", ".join(fautes)
    return "controle : chaque face ne porte qu'un seul de"


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
