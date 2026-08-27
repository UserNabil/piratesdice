#!/usr/bin/env python3
"""
outils/loader.py — REMETTRE LE LOADER A PLAT, IMAGE PAR IMAGE.

    python3 outils/loader.py assets/icon_loader_source.png

⛔ CE FICHIER NAIT DE DEUX ECHECS OPPOSES. Le dessin livre par l'admin est un
APNG dont les six dernieres images ne sont que des RETOUCHES : un rectangle de
128 x 405 pixels sur le bord droit, la ou tourne l'arc de progression. Le reste
— la loupe, la carte, le pirate — n'existe QUE dans la premiere image.

  1. Re-encode image par image avec Pillow, chaque retouche a ete redimensionnee
     et reecrite comme une image PLEINE : la roue apparaissait « decoupee ».
  2. Copie telle quelle, elle jouait correctement… la ou le lecteur d'APNG suit
     la lettre de la norme. Les retouches s'appuient sur `dispose = PREVIOUS`
     pour deux images sur sept — le mode le moins bien suivi des trois — et sur
     `blend = SOURCE`, qui EFFACE la region avant de la repeindre. Quand le
     lecteur se trompe, il ne reste a l'ecran que la bande de droite : un bout
     d'arc et le canon de la longue-vue, sur fond vide.

CE QUE FAIT CE SCRIPT. Il COMPOSE les sept images (Pillow applique les regles
d'assemblage a la lecture), puis les reecrit PLEINES, sans retouche ni
disposition a interpreter. Il n'y a plus rien a comprendre pour le lecteur :
sept images completes qui se succedent.

⚠️ ET IL CORRIGE LA CADENCE. Le fichier d'origine donne UNE SECONDE par image,
soit sept secondes par tour : a l'ecran, une image fixe qui saute de temps en
temps. Un chargement doit tourner — cent dix millisecondes par image.

⚠️ QUANTIFIE, SINON IL PESE TROIS MEGA-OCTETS. Sept images pleines en couleurs
vraies, pour un dessin a aplats cernes de noir. Mesure : 255 couleurs pesent
1245 Ko, 128 en pesent 1039 — soit exactement le poids du fichier d'origine, qui
ne portait pourtant qu'UNE image pleine — et l'ecart moyen passe de 1,97 a 2,58
niveaux sur 255, invisible sur un aplat.
"""
import os
import sys

from PIL import Image, ImageSequence

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
CIBLE = os.path.join(RACINE, "www", "dice", "img", "icon_loader.png")
DUREE = 110          # millisecondes par image
COULEURS = 128


def composer(chemin):
    """Les images PLEINES, telles qu'un lecteur correct les afficherait."""
    im = Image.open(chemin)
    return [f.convert("RGBA").copy() for f in ImageSequence.Iterator(im)]


def main(argv):
    source = argv[0] if argv else CIBLE
    images = composer(source)
    if len(images) < 2:
        sys.exit("REFUS : %s n'a qu'une image — ce n'est pas une animation." % source)

    petites = [i.quantize(colors=COULEURS, method=Image.FASTOCTREE).convert("RGBA")
               for i in images]
    petites[0].save(CIBLE, save_all=True, append_images=petites[1:],
                    duration=DUREE, loop=0, disposal=0, blend=0, optimize=True)

    poids = os.path.getsize(CIBLE) / 1024
    print("%d images pleines, %d ms chacune (%.1f s le tour)"
          % (len(petites), DUREE, len(petites) * DUREE / 1000))
    print("%s : %.0f Ko" % (os.path.relpath(CIBLE, RACINE), poids))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
