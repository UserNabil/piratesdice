# Audit — pd/outils/assets.py (163 lignes)

Fichier lu en entier. Lot annonce **5 fonctions**, **5 nommées trouvées** (+3 lambdas inline non comptées ; écart 0 sur les nommées). Outil CLI développeur : pose/découpe des images d'assets. Hors runtime jeu.

## (a) Fonctions

| nom | ligne |
|---|---|
| contenu | 30 |
| poser | 36 |
| decouper | 55 |
| ilots | 75 |
| main | 130 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| contenu | boîte alpha ≥ SEUIL du dessin | `getchannel("A")` suppose RGBA — tous les appelants convertissent en RGBA d'abord. Renvoie None si vide. | OK |
| poser | recadre sur le contenu, réinscrit centré et sauve | `Image.open(source)` fichier absent → traceback (CLI). Boîte vide → `SystemExit` propre. `--cote 0` hostile → toile 0×0 (dev contrôle l'arg). | OK |
| decouper | découpe une planche NxM en cases | `grille.split("x")` malformé → `ValueError` non attrapé (CLI). Nb cases ≠ nb cibles → `SystemExit` propre. **`/tmp/_case.png` partagé** → course/incompatible Windows. | OK |
| ilots | trouve les régions connexes sans grille | flood-fill O(w·h), `vu` = w·h booléens (mémoire lourde sur grande image, borné). Nb îlots ≠ nb cibles → `SystemExit`. **`/tmp/_ilot.png` partagé**. | OK |
| main | dispatch poser/ilots/decouper + `--cote` | `int(args[i+1])` / `args[0]`,`args[1]` → `ValueError`/`IndexError` non attrapés si args manquants (CLI). | OK |

## (c) Findings

- **assets.py:70,125 | cosmétique (course/portabilité)** | `tampon = "/tmp/_case.png"` et `"/tmp/_ilot.png"` : chemins temporaires fixes et partagés. Deux exécutions concurrentes s'écraseraient mutuellement le tampon (sortie erronée) ; `/tmp` n'existe pas sous Windows. `tempfile.NamedTemporaryFile` serait robuste. Sans effet en usage mono-utilisateur.
- **assets.py:56 | cosmétique** | `int(n) for n in grille.lower().split("x")` — une grille mal formée (`"3-2"`) lève `ValueError` en traceback plutôt qu'un message. CLI développeur.
- **Grille** : pas d'async ; entrées = args CLI (pas de client hostile) ; échec en cours de `decouper`/`ilots` (fichier illisible) laisserait une sortie partielle, mais les gardes `SystemExit` signalent l'échec.

**Verdict : OK** (findings cosmétiques, outil CLI développeur).
