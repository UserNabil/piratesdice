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
PLANCHE_3 = os.path.join(RACINE, 'assets', 'motifs_source_3.png')
PLANCHE_4 = os.path.join(RACINE, 'assets', 'motifs_source_4.png')
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
          ('M008', 'ailes', (1, 1), 2),
          # Une troisieme planche, et les memes regles : quatre ornements de
          # plus, quatre hauts faits de plus a rendre legendaires. Ils ne
          # s'achetent pas davantage que les precedents.
          ('M009', 'sakura', (0, 0), 3),
          ('M010', 'azteque', (0, 1), 3),
          ('M011', 'gothique', (1, 0), 3),
          ('M012', 'rouages', (1, 1), 3),
          # Une quatrieme planche : les quatre gravures du Butin du Jour.
          ('M013', 'vagues', (0, 0), 4),
          ('M014', 'boussole', (0, 1), 4),
          ('M015', 'chaines', (1, 0), 4),
          ('M016', 'couronne', (1, 1), 4)]

# ⚠️ ON NE GRAVE QUE LES JEUX EN VENTE. Les quatre jeux retires (S003 a S005,
# S007) ajouteraient seize megaoctets pour des combinaisons que personne ne peut
# acheter. Le client sait retomber sur le jeu nu quand la combinaison n'existe
# pas ; le jour ou l'un d'eux revient au catalogue, il suffit de l'ajouter ici.
# Les sept parures de 034_des_nouveaux.sql sont gravees comme les autres : une
# gravure achetee doit se porter sur N'IMPORTE quel de, sinon elle vaut moins
# cher selon le de qu'on aime — ce que personne ne comprendrait.
JEUX = ['D000', 'S002', 'S006', 'S008', 'S009', 'S010',
        'S011', 'S012', 'S013', 'S014', 'S015', 'S016']

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


MINI_PIP = 250     # px : en dessous, c'est la trame du de, pas un point
FACE_BAS, FACE_HAUT = 0.35, 0.65   # part du de qu'une VRAIE face occupe


def compte_pips(pleine, visage, mini=MINI_PIP):
    """Combien de POINTS porte cette face — la trame du de ne compte pas.

    Les des sont tramas de petits points ; `binary_fill_holes` en fait des
    dizaines de trous minuscules. Seuls les trous larges sont des pips.
    """
    trous = pleine & ~visage
    lab, n = ndimage.label(trous)
    if not n:
        return 0
    tailles = ndimage.sum(trous, lab, range(1, n + 1))
    return int((tailles >= mini).sum())


def anatomie(a, attendu=None):
    """La face, et les pips — lus dans l'image, jamais supposes.

    ⛔ LA PREMIERE VERSION PRENAIT LA ZONE CLAIRE QUI CONTIENT LE CENTRE, et
    elle a rate vingt-quatre faces sur cent quarante-quatre : celles dont le
    point du milieu est en BRAISE. Un pip allume est clair lui aussi — le
    centre tombait donc dedans, la « face » mesurait neuf cent cinquante pixels
    au lieu de trente-quatre mille, et le motif se gravait a l'interieur du
    point. On prend donc la PLUS GRANDE zone claire.

    ⛔ ET UN SEUIL FIXE NE VOIT QUE LES DES CLAIRS. `L > 100` trouve la face des
    six premiers jeux (luminance mediane 139 a 196) mais rend le LISERE BLANC
    sur les jeux sombres arrives depuis — lave (mediane 81), royale (82), onyx
    (44) : treize pour cent du de au lieu de quarante-cinq, donc une gravure
    posee sur le contour. Mesure du 2026-09-04 sur les treize jeux.

    On ne suppose donc plus le seuil, on le CHERCHE — mais seulement quand il le
    faut : la methode d'origine passe en premier et, si elle rend une face
    plausible avec le bon nombre de points, c'est elle qui gagne. Les soixante-
    douze combinaisons deja livrees ne bougent pas. Sinon on balaie les seuils
    et on retient la face qui porte EXACTEMENT les points attendus (le nom du
    fichier les annonce), en ecartant tout ce qui touche le bord du de — le
    lisere le touche par definition, la face jamais.
    """
    de = a[..., 3] > 128
    aire = de.sum()
    if not aire:
        raise ValueError('image vide : ce n est pas un de')
    L = a[..., :3].mean(2)

    def juger(visage):
        """Une face plausible, et ses points."""
        if not (FACE_BAS * aire <= visage.sum() <= FACE_HAUT * aire):
            return None
        pleine = ndimage.binary_fill_holes(visage)
        return pleine, compte_pips(pleine, visage)

    # 1. LA METHODE D'ORIGINE. Elle a fait ses preuves sur les jeux clairs.
    clair = de & (L > 100)
    lab, n = ndimage.label(clair)
    if n:
        tailles = ndimage.sum(clair, lab, range(1, n + 1))
        visage = lab == (int(np.argmax(tailles)) + 1)
        verdict = juger(visage)
        if verdict and (attendu is None or verdict[1] == attendu):
            pleine = verdict[0]
            return pleine, visage, pleine & ~visage

    # 2. SINON, ON CHERCHE LE SEUIL.
    bord = de & ~ndimage.binary_erosion(de, iterations=3)
    candidats, vus = [], set()
    for seuil in range(15, 210, 5):
        marque = de & (L > seuil)
        lab, n = ndimage.label(marque)
        if not n:
            continue
        interdits = set(np.unique(lab[bord])) - {0}
        tailles = ndimage.sum(marque, lab, range(1, n + 1))
        for ident in range(1, n + 1):
            if ident in interdits:
                continue
            taille = int(tailles[ident - 1])
            if taille in vus or not (FACE_BAS * aire <= taille <= FACE_HAUT * aire):
                continue
            vus.add(taille)
            visage = lab == ident
            verdict = juger(visage)
            if verdict:
                candidats.append((visage, verdict[0], verdict[1], taille))
    if not candidats:
        raise ValueError('aucune face lisible : ce n est pas un de')
    justes = [c for c in candidats if attendu is not None and c[2] == attendu]
    if justes:
        visage, pleine, _, _ = max(justes, key=lambda c: c[3])
    else:
        # Aucun seuil ne rend le compte juste (un pip dessine en plusieurs
        # morceaux, comme la couronne de la parure royale) : on prend la face
        # qui montre le plus de points, la plus large a egalite.
        visage, pleine, _, _ = max(candidats, key=lambda c: (c[2], c[3]))
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


def graver(chemin_de, motif, pips_froids=None):
    im = Image.open(chemin_de).convert('RGBA')
    a = np.array(im).astype(int)
    # `die_4_hot.png` annonce quatre points : c'est ce qui permet a `anatomie`
    # de choisir le bon seuil sur les jeux sombres au lieu de le supposer.
    nom = os.path.basename(chemin_de)
    attendu = int(nom[4]) if nom.startswith('die_') and nom[4].isdigit() else None
    pleine, visage, pips = anatomie(a, attendu)
    # ⛔ LE HALO D'UNE BRAISE FAIT ECLATER LE MASQUE DES POINTS. Un point allume
    # est clair comme la face : il cesse d'etre un TROU dans celle-ci, et
    # `anatomie` ne le rend plus qu'en miettes — mesure sur la parure royale,
    # face 2 en braise : 2897 px en CENT SIX fragments, la ou la meme face
    # froide donne 4190 px en deux taches franches. Resultat a l'ecran : la
    # gravure passait DEVANT les couronnes et la valeur du de devenait illisible
    # (jusqu'a 50 % de l'or d'un point recouvert).
    # La face froide, elle, porte ses points au MEME endroit et les rend
    # proprement : on lui emprunte son masque. L'union des deux ne peut que
    # rendre plus de points a leur place, jamais moins.
    if pips_froids is not None and pips_froids.shape == pips.shape:
        pips = pips | pips_froids
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


def pips_des_faces_froides(jeu):
    """Les points de chaque face FROIDE, par valeur — le masque de secours des
    faces en braise (voir `graver`). Calcule une fois par jeu : il ne depend pas
    du motif qu'on grave."""
    out = {}
    dossier = dossier_du_jeu(jeu)
    for valeur in range(1, 7):
        chemin = os.path.join(dossier, 'die_%d.png' % valeur)
        if not os.path.isfile(chemin):
            continue
        a = np.array(Image.open(chemin).convert('RGBA')).astype(int)
        try:
            _, _, pips = anatomie(a, valeur)
        except ValueError:
            continue
        out[valeur] = pips
    return out


def morceaux():
    planches = {1: Image.open(PLANCHE).convert('RGBA'),
                2: Image.open(PLANCHE_2).convert('RGBA'),
                3: Image.open(PLANCHE_3).convert('RGBA'),
                4: Image.open(PLANCHE_4).convert('RGBA')}
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


def tout(ecrire=True, jeux=None):
    pieces = morceaux()
    total = 0
    for jeu in (jeux or JEUX):
        secours = pips_des_faces_froides(jeu)
        for ident, (nom, motif) in pieces.items():
            cible = os.path.join(SKINS, '%s_%s' % (jeu, ident))
            if ecrire:
                os.makedirs(cible, exist_ok=True)
            for fichier, chemin in faces(jeu):
                froids = (secours.get(int(fichier[4]))
                          if fichier.endswith('_hot.png') else None)
                grave = graver(chemin, motif, froids)
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


def verifier(jeux=None):
    """Chaque face gravee porte-t-elle VRAIMENT sa gravure ?

    ⛔ CE CONTROLE NAIT D'UNE LIVRAISON RATEE. Le script annoncait « 144 faces
    gravees » et vingt-quatre d'entre elles etaient la copie exacte de leur
    source : le compte etait juste, le travail non. Compter des fichiers ecrits
    ne prouve rien — on compare donc l'image gravee a celle dont elle sort.
    Moins de 3 % de pixels changes, c'est qu'il ne s'est rien passe.
    """
    fautes = []
    for jeu in (jeux or JEUX):
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
    # ⚠️ POUR GRAVER EN PARALLELE. Deux cent huit combinaisons a la file
    # prennent des minutes ; chaque jeu ecrit dans SON dossier, donc rien ne se
    # marche dessus. `--jeux S011,S012` limite le travail a ces jeux-la.
    ap.add_argument('--jeux', default=None,
                    help='ne graver que ces jeux (separes par des virgules)')
    args = ap.parse_args()
    choisis = [j.strip() for j in args.jeux.split(',')] if args.jeux else None
    if choisis:
        inconnus = [j for j in choisis if j not in JEUX]
        if inconnus:
            raise SystemExit('jeux inconnus : ' + ', '.join(inconnus))
    if args.planche:
        return planche_de_controle()
    if args.verifier:
        fautes = verifier(choisis)
        for f in fautes:
            print('  ✖ ' + f)
        print('%d face(s) sans gravure' % len(fautes) if fautes
              else 'toutes les faces portent leur gravure')
        return 1 if fautes else 0
    n = tout(jeux=choisis)
    print('%d faces gravees dans www/dice/img/skins/' % n)
    # ⚠️ ON NE SE CROIT PAS SUR PAROLE : le compte de fichiers ecrits ne dit pas
    # que la gravure y est. On relit ce qu'on vient d'ecrire.
    fautes = verifier(choisis)
    for f in fautes:
        print('  ✖ ' + f)
    if fautes:
        print('%d face(s) sans gravure — RIEN N EST BON' % len(fautes))
        return 1
    print('controle : les %d faces portent leur gravure' % n)
    return 0


if __name__ == '__main__':
    sys.exit(main() or 0)
