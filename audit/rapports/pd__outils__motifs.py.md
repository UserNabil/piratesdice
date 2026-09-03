# Rapport d'audit — `pd/outils/motifs.py`

Outil HORS LIGNE (build) : grave les motifs dans les faces des dés et vérifie le
résultat. Lancé à la main par le développeur. Les exceptions y sont voulues
« fail-loud » (un traceback arrête le script au lieu de produire des assets faux).

## a) Fonctions (nom | ligne)
- dossier_du_jeu | 92
- anatomie | 96
- couleur_du_motif | 128
- graver | 148
- morceaux | 171
- faces | 183
- tout | 193
- planche_de_controle | 213
- source | 229
- verifier | 233
- main | 263

11 fonctions — conforme au lot (11).

## b) Par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| dossier_du_jeu | Chemin du dossier d'un jeu de dés | aucun (pure) | OK |
| anatomie | Isole la face + les pips dans l'image | `raise ValueError` si pas de zone claire / face suspecte ; non attrapé, mais c'est une validation fail-loud d'outil (traceback = comportement voulu) | OK |
| couleur_du_motif | Teinte saturée assombrie de la face | échantillonne `px[::37]` ; `forts` vide → repli sur `hsv` déjà géré | OK |
| graver | Compose le motif sous les pips d'une face | `Image.open` sans `with` (fp fermé par CPython au load via np.array) ; `r["data"]`/fichier manquant → fail-loud | OK |
| morceaux | Découpe les 3 planches source | `Image.open` d'une planche absente → FileNotFoundError fail-loud | OK |
| faces | Génère (nom, chemin) des faces existantes | vérifie `isfile` | OK |
| tout | Grave toutes les combinaisons et écrit | écriture partielle possible si crash en cours, MAIS `main` relance `verifier()` après pour le détecter | OK |
| planche_de_controle | Planche de contrôle sans écriture d'assets | `col % 6 + 1` borne l'index de face (documenté) | OK |
| source | Chemin d'une face source | aucun | OK |
| verifier | Compare gravures et sources (≥3 % px changés) | gère absent / taille différente | OK |
| main | Point d'entrée argparse ; grave puis relit | retourne un code ; auto-contrôle par `verifier()` | OK |

## c) Findings détaillés
Aucune faille. Toutes les levées d'exception (`anatomie`, ouverture de fichiers)
sont des validations volontaires d'un outil de build : elles arrêtent bruyamment
le script plutôt que d'émettre des assets incorrects, et `main` relit son propre
travail via `verifier()` (le fichier documente lui-même ce garde-fou, ligne 281).
Pas de concurrence, pas de ressource laissée ouverte de façon significative.
