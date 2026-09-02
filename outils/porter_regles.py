#!/usr/bin/env python3
"""
outils/porter_regles.py — LES REGLES DU JEU, COPIEES DU SERVEUR AU CLIENT.

    python3 outils/porter_regles.py            # ecrit la copie
    python3 outils/porter_regles.py --verifier  # echoue si la copie a derive

⛔ DEUX IMPLEMENTATIONS DES REGLES, C'EST DEUX VERITES. Le mode hors ligne oblige
le client a marquer des points tout seul : il lui faut donc `columnScore`,
`place`, `destroyMatching`. Les REECRIRE aurait garanti la divergence — ce depot
l'a deja payee ailleurs (« aucun ecran ne doit afficher un total different de
celui qui decide de la partie »), et le score des colonnes a change trois fois
depuis : les quarts du pont, la benediction, le carre des occurrences.

On COPIE donc, machinalement, et on refuse de construire si la copie a derive.
La conversion est mecanique : `module.exports = {...}` devient `export {...}`, et
rien d'autre ne bouge. Le fichier client porte en tete d'ou il vient et se
declare non modifiable a la main.

⚠️ ET ON N'EMPORTE PAS TOUT. Le classement (`ratingDelta`, `notesEnJeu`,
`prime`) n'a rien a faire dans un telephone : c'est une decision de serveur, et
la copier reviendrait a publier la formule anti-triche.
"""
import argparse
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
SOURCE = os.path.join(os.path.dirname(RACINE), 'dice-server', 'src', 'game', 'rules.js')
CIBLE = os.path.join(RACINE, 'www', 'js', 'pages', 'dice_regles.js')

# Ce que le client a besoin de savoir pour jouer hors ligne. Le classement reste
# au serveur : il decide, le telephone ne fait que jouer.
GARDE = [
    'COLUMNS', 'COLUMN_SIZE', 'CELLS', 'DIE_FACES', 'QUARTERS',
    'emptyGrid', 'columnOf', 'cellsOfColumn', 'columnValues',
    'isColumnFull', 'isFull', 'isEmpty', 'freeCellInColumn',
    'place', 'compact', 'columnScore', 'columnScores', 'totalScore',
    'drawQuarters', 'destroyMatching', 'destroyValueInColumn', 'clearCell', 'rollDie',
    # ⚠️ CETTE LISTE AVAIT PRIS DEUX FONCTIONS DE RETARD. `clearColumn` et
    # `swapCell` etaient exportees par le fichier ENGENDRE sans figurer ici :
    # quelqu'un avait donc corrige la copie a la main, ce que son propre en-tete
    # interdit. `--verifier` le disait depuis, et personne ne le lisait.
    'clearColumn', 'swapCell',
    # Les quatre briques du second lot d'effets (B012 a B016). Le mode hors
    # ligne joue les memes effets que le mode en ligne : sans elles, cinq
    # capitaines seraient injouables sans reseau — et pire, le telephone
    # produirait un journal que le serveur refuserait.
    'suivreCase', 'topCell', 'moveTop', 'swapQuarters',
]

ENTETE = """/* ============================================================================
   pages/dice_regles.js — LES REGLES, COPIEES DU SERVEUR. NE PAS MODIFIER ICI.

   ⛔ CE FICHIER EST ENGENDRE par `outils/porter_regles.py` depuis
   `dice-server/src/game/rules.js`. Toute correction se fait LA-BAS, puis on
   relance l'outil. Une retouche a la main ici creerait exactement ce qu'on
   cherche a eviter : deux regles du jeu qui divergent en silence, et un ecran
   qui affiche un total que la partie n'a jamais eu.

   Il sert au mode HORS LIGNE, ou le telephone doit marquer les points tout
   seul. En ligne, c'est toujours le serveur qui tranche.
   ============================================================================ */

"""


def convertir(src):
    """Le module CommonJS du serveur, rendu en module ES pour le client."""
    corps = re.sub(r"^'use strict';\s*", '', src, flags=re.M)
    corps = re.sub(r'module\.exports\s*=\s*\{[^}]*\};\s*$', '', corps, flags=re.S)
    gardees = [n for n in GARDE if re.search(r'\b(?:function|const)\s+' + n + r'\b', corps)]
    manquantes = [n for n in GARDE if n not in gardees]
    if manquantes:
        sys.exit('ABSENTES de la source : ' + ', '.join(manquantes))
    return ENTETE + corps.strip() + '\n\nexport {\n  ' + ',\n  '.join(gardees) + ',\n};\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--verifier', action='store_true')
    args = ap.parse_args()

    if not os.path.isfile(SOURCE):
        if args.verifier:
            print('source du serveur absente : copie non verifiee')
            return 0
        sys.exit('source introuvable : ' + SOURCE)

    attendu = convertir(open(SOURCE, encoding='utf-8').read())
    actuel = open(CIBLE, encoding='utf-8').read() if os.path.isfile(CIBLE) else ''

    if args.verifier:
        if attendu != actuel:
            sys.exit('⛔ LES REGLES DU CLIENT ONT DERIVE DE CELLES DU SERVEUR.\n'
                     '   Relancez : python3 outils/porter_regles.py')
        print('regles : la copie du client est conforme au serveur')
        return 0

    open(CIBLE, 'w', encoding='utf-8').write(attendu)
    print('regles portees : %s (%d octets)' % (os.path.relpath(CIBLE, RACINE), len(attendu)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
