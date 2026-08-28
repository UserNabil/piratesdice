#!/usr/bin/env python3
"""
outils/motifs.py — GRAVER LES MOTIFS DANS LES DES, UNE FOIS POUR TOUTES.

    python3 outils/motifs.py            # regenere tout
    python3 outils/motifs.py --planche  # une planche de controle, sans rien ecrire

⛔ PAS DE SUPERPOSITION CSS. Une image posee par-dessus une autre demande a
l'ecran de tenir deux boites alignees au pixel, a toutes les tailles, pendant
que le de tourne, rebondit et change de face. Ce depot a deja paye ce prix
ailleurs (le sceau de gel : six cadrages rates). Un motif grave dans l'image ne
peut plus se decaler : il n'y a plus qu'une image.

CE QUE FAIT CE SCRIPT. Il decoupe la planche des quatre motifs, puis, pour
chaque jeu de des et chaque motif, il refait les douze faces :

  1. IL LIT L'ANATOMIE DU DE. La face claire est la composante qui contient le
     centre ; les pips sont les trous de cette composante. Rien n'est code en
     dur : un nouveau jeu de des passe dans la meme moulinette.
  2. IL PREND LA COULEUR AU DE LUI-MEME. Pas une couleur choisie a la main : la
     teinte la plus SATUREE de la face, assombrie. Un motif dore sur les des
     d'or, turquoise sur ceux du sultan — c'est la demande, et c'est aussi la
     seule facon de tenir avec les jeux qui n'existent pas encore.
  3. IL POSE LE MOTIF SOUS LES PIPS. Grave par-dessus, il barrerait les points
     qu'on doit lire d'un coup d'oeil. Les pips sont remis a la fin, intacts.

⚠️ ET IL QUANTIFIE. Une face gravee pese 103 Ko en couleurs vraies, 20 Ko sur
une palette de 255 — pour un ecart moyen de 2,7 niveaux sur 255, invisible sur
un aplat cerne de noir. Douze combinaisons a 103 Ko auraient ajoute quinze
megaoctets a l'application ; a 20 Ko elles en ajoutent trois.
"""
import argparse
import colorsys
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
PLANCHE = os.path.join(RACINE, 'assets', 'motifs_source.png')
PLANCHE_2 = os.path.join(RACINE, 'assets', 'motifs_source_2.png')
SKINS = os.path.join(RACINE, 'www', 'dice', 'img', 'skins')
BASE = os.path.join(RACINE, 'www', 'dice', 'img')

# L'ordre de la planche : deux lignes, deux colonnes. Le quatrieme champ dit
# DE QUELLE PLANCHE vient le morceau — il y en a deux depuis que quatre
# ornements sont venus s'ajouter aux quatre premiers.
MOTIFS = [('M001', 'dragon', (0, 0), 1),
          ('M002', 'tentacule', (0, 1), 1),
          ('M003', 'os', (1, 0), 1),
          ('M004', 'joyaux', (1, 1), 1),
          # ⚠️ LES QUATRE ORNEMENTS NE S'ACHETENT PAS. Ils sont la recompense
          # des hauts faits legendaires — les huit plus durs du jeu. Un objet
          # qu'on ne peut pas acheter est le seul qui dise vraiment quelque
          # chose de celui qui le porte.
          ('M005', 'lanternes', (0, 0), 2),
          ('M006', 'paon', (0, 1), 2),
          ('M007', 'vigne', (1, 0), 2),
          ('M008', 'ailes', (1, 1), 2)]

# ⚠️ ON NE GRAVE QUE LES JEUX EN VENTE. Les quatre jeux retires (S003 a S005,
# S007) ajouteraient huit megaoctets pour des combinaisons que personne ne peut
# acheter. Le client sait retomber sur le jeu nu quand la combinaison n'existe
# pas ; le jour ou l'un d'eux revient au catalogue, il suffit de l'ajouter ici.
JEUX = ['D000', 'S002', 'S006', 'S008', 'S009', 'S010']

MOTIFS_PAR_ID = {ident: nom for ident, nom, _, _ in MOTIFS}

MARGE = 4          # de pixels entre le motif et le cadre du de
SATURER = 1.35
# ⚠️ UN FACTEUR FIXE NE SUFFIT PAS. Assombrir de 40 % marche sur le sultan,
# clair, et rate sur les des d'or : leur teinte etant deja lumineuse, 60 % de
# beaucoup reste beaucoup, et le motif se noyait dans la face. On vise donc un
# ECART, pas un pourcentage — le dessin doit se detacher, quelle que soit la
# couleur de depart.
ASSOMBRIR = 0.45
ECART_MINI = 0.35
NOIRCEUR_MAXI = 0.12


def dossier_du_jeu(jeu):
    return BASE if jeu == 'D000' else os.path.join(SKINS, jeu)


def anatomie(a):
    """La face, et les pips — lus dans l'image, jamais supposes.

    ⛔ LA PREMIERE VERSION PRENAIT LA ZONE CLAIRE QUI CONTIENT LE CENTRE, et
    elle a rate vingt-quatre faces sur cent quarante-quatre : celles dont le
    point du milieu est en BRAISE. Un pip allume est clair lui aussi — le
    centre tombait donc dedans, la « face » mesurait neuf cent cinquante pixels
    au lieu de trente-quatre mille, et le motif se gravait a l'interieur du
    point. A l'ecran : un plateau ou les des chauds n'avaient pas de gravure,
    et eux seuls.

    On prend donc la PLUS GRANDE zone claire. Le lisere blanc du de en est une
    autre (six mille pixels contre trente-quatre mille) et ne peut pas gagner ;
    un pip, allume ou non, encore moins. Aucun cas particulier a prevoir, et
    `--verifier` le prouve face par face.
    """
    L = a[..., :3].mean(2)
    de = a[..., 3] > 128
    clair = de & (L > 100)
    lab, n = ndimage.label(clair)
    if not n:
        raise ValueError('aucune zone claire : ce n est pas un de')
    tailles = ndimage.sum(clair, lab, range(1, n + 1))
    ident = int(np.argmax(tailles)) + 1
    visage = lab == ident
    if visage.sum() < de.sum() * 0.25:
        raise ValueError('face suspecte : %d px pour un de de %d px'
                         % (visage.sum(), de.sum()))
    pleine = ndimage.binary_fill_holes(visage)
    return pleine, visage, pleine & ~visage


def couleur_du_motif(a, visage):
    """La teinte la plus saturee de la face, assombrie.

    C'est la consigne — « recolorier par rapport aux des, mais plus fonce » —
    et c'est aussi ce qui evite une table de correspondances a maintenir.
    """
    px = a[visage][:, :3].astype(float) / 255
    hsv = np.array([colorsys.rgb_to_hsv(*p) for p in px[::37]])
    seuil = np.quantile(hsv[:, 1], .90) * .8
    forts = hsv[hsv[:, 1] >= seuil]
    if not len(forts):
        forts = hsv
    h = float(np.median(forts[:, 0]))
    s = min(1.0, float(np.median(forts[:, 1])) * SATURER)
    clair = float(np.median(hsv[:, 2]))          # la face, pas seulement l'accent
    v = min(clair * ASSOMBRIR, clair - ECART_MINI)
    v = max(NOIRCEUR_MAXI, v)
    return tuple(int(255 * c) for c in colorsys.hsv_to_rgb(h, s, v))


def graver(chemin_de, motif):
    im = Image.open(chemin_de).convert('RGBA')
    a = np.array(im).astype(int)
    pleine, visage, pips = anatomie(a)
    # La couleur se lit LOIN des pips : leur halo clair fausserait la teinte.
    propre = visage & ~ndimage.binary_dilation(pips, iterations=3)
    coul = couleur_du_motif(a, propre if propre.any() else visage)

    ys, xs = np.nonzero(pleine)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    m = motif.resize((x1 - x0 + 1, y1 - y0 + 1), Image.LANCZOS)
    alpha = np.zeros(a.shape[:2], dtype=float)
    alpha[y0:y1 + 1, x0:x1 + 1] = np.array(m)[..., 3] / 255.0
    alpha *= ndimage.binary_erosion(pleine, iterations=MARGE)

    out = a.astype(float)
    for c in range(3):
        out[..., c] = out[..., c] * (1 - alpha) + coul[c] * alpha
    res = out.astype(np.uint8)
    res[pips] = a[pips].astype(np.uint8)        # les points repassent devant
    return Image.fromarray(res)


def morceaux():
    planches = {1: Image.open(PLANCHE).convert('RGBA'),
                2: Image.open(PLANCHE_2).convert('RGBA')}
    out = {}
    for ident, nom, (i, j), num in MOTIFS:
        planche = planches[num]
        cote = planche.width // 2
        out[ident] = (nom, planche.crop((j * cote, i * cote, (j + 1) * cote, (i + 1) * cote)))
    return out


def faces(jeu):
    d = dossier_du_jeu(jeu)
    for n in range(1, 7):
        for suffixe in ('', '_hot'):
            nom = 'die_%d%s.png' % (n, suffixe)
            chemin = os.path.join(d, nom)
            if os.path.isfile(chemin):
                yield nom, chemin


def tout(ecrire=True):
    pieces = morceaux()
    total = 0
    for jeu in JEUX:
        for ident, (nom, motif) in pieces.items():
            cible = os.path.join(SKINS, '%s_%s' % (jeu, ident))
            if ecrire:
                os.makedirs(cible, exist_ok=True)
            for fichier, chemin in faces(jeu):
                grave = graver(chemin, motif)
                if not ecrire:
                    continue
                # Palette de 255 couleurs : cinq fois plus leger, invisible a l'oeil.
                grave.quantize(colors=255, method=Image.FASTOCTREE).save(
                    os.path.join(cible, fichier))
                total += 1
            print('  %s + %-9s -> %s' % (jeu, nom, os.path.basename(cible)))
    return total


def planche_de_controle():
    pieces = morceaux()
    sortie = Image.new('RGBA', (256 * len(pieces), 256 * len(JEUX)), (12, 10, 20, 255))
    for ligne, jeu in enumerate(JEUX):
        for col, (ident, (nom, motif)) in enumerate(pieces.items()):
            # ⚠️ LA FACE TOURNE AVEC LA COLONNE, ET ELLE BOUCLE. Ecrit pour
            # quatre motifs, ce calcul demandait `die_7` des qu'il y en a eu
            # huit — un fichier qui n'existe pas. Une planche de controle qui
            # tombe est une planche qu'on n'ouvre plus.
            chemin = os.path.join(dossier_du_jeu(jeu), 'die_%d.png' % (col % 6 + 1))
            sortie.paste(graver(chemin, motif), (col * 256, ligne * 256))
    chemin = os.path.join(RACINE, 'controle_motifs.png')
    sortie.save(chemin)
    print('planche de controle :', chemin)


def source(jeu, fichier):
    return os.path.join(dossier_du_jeu(jeu), fichier)


def verifier():
    """Chaque face gravee porte-t-elle VRAIMENT sa gravure ?

    ⛔ CE CONTROLE NAIT D'UNE LIVRAISON RATEE. Le script annoncait « 144 faces
    gravees » et vingt-quatre d'entre elles etaient la copie exacte de leur
    source : le compte etait juste, le travail non. Compter des fichiers ecrits
    ne prouve rien — on compare donc l'image gravee a celle dont elle sort.
    Moins de 3 % de pixels changes, c'est qu'il ne s'est rien passe.
    """
    fautes = []
    for jeu in JEUX:
        for ident, _ in MOTIFS_PAR_ID.items():
            combo = os.path.join(SKINS, '%s_%s' % (jeu, ident))
            for fichier, chemin in faces(jeu):
                cible = os.path.join(combo, fichier)
                if not os.path.isfile(cible):
                    fautes.append('%s/%s : absent' % (os.path.basename(combo), fichier))
                    continue
                avant = np.array(Image.open(chemin).convert('RGBA')).astype(int)
                apres = np.array(Image.open(cible).convert('RGBA')).astype(int)
                if avant.shape != apres.shape:
                    fautes.append('%s/%s : taille differente' % (os.path.basename(combo), fichier))
                    continue
                bouge = (np.abs(avant - apres)[..., :3].mean(2) > 12).mean() * 100
                if bouge < 3:
                    fautes.append('%s/%s : gravure absente (%.1f %% de pixels changes)'
                                  % (os.path.basename(combo), fichier, bouge))
    return fautes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--planche', action='store_true',
                    help='ecrit une planche de controle et ne touche a rien')
    ap.add_argument('--verifier', action='store_true',
                    help='compare les gravures a leurs sources, sans rien ecrire')
    args = ap.parse_args()
    if args.planche:
        return planche_de_controle()
    if args.verifier:
        fautes = verifier()
        for f in fautes:
            print('  ✖ ' + f)
        print('%d face(s) sans gravure' % len(fautes) if fautes
              else 'toutes les faces portent leur gravure')
        return 1 if fautes else 0
    n = tout()
    print('%d faces gravees dans www/dice/img/skins/' % n)
    # ⚠️ ON NE SE CROIT PAS SUR PAROLE : le compte de fichiers ecrits ne dit pas
    # que la gravure y est. On relit ce qu'on vient d'ecrire.
    fautes = verifier()
    for f in fautes:
        print('  ✖ ' + f)
    if fautes:
        print('%d face(s) sans gravure — RIEN N EST BON' % len(fautes))
        return 1
    print('controle : les %d faces portent leur gravure' % n)
    return 0


if __name__ == '__main__':
    sys.exit(main() or 0)
