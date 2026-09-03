# Audit — pd/outils/loader.py (73 lignes)

Fichier lu en entier. Lot annonce **2 fonctions**, **2 trouvées** (écart 0). Outil CLI développeur : ré-encode l'APNG du loader en 7 images pleines quantifiées. Hors runtime jeu.

## (a) Fonctions

| nom | ligne |
|---|---|
| composer | 48 |
| main | 54 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| composer | lit un APNG, rend la liste des images pleines RGBA | `Image.open(chemin)` non-image → exception non attrapée (CLI) ; **`im` / l'itérateur non fermés explicitement** (fuite mineure). Fichier à une seule image → renvoie 1 élément (géré par `main`). | OK |
| main | ré-encode et écrit `icon_loader.png` | `len(images) < 2` → `sys.exit` propre. **`source = argv[0] if argv else CIBLE`** : sans argument, lit `CIBLE` puis **écrase `CIBLE` par lui-même re-quantifié** → dégradation cumulative de qualité à chaque relance à vide. `quantize`/`save` OK. | OK |

## (c) Findings

- **loader.py:55,62 | cosmétique (dev)** | `source = argv[0] if argv else CIBLE` puis `petites[0].save(CIBLE, ...)` : lancé sans argument, l'outil lit et réécrit le même `www/dice/img/icon_loader.png`. Comme l'image de sortie est déjà quantifiée à 128 couleurs, chaque exécution à vide re-quantifie une image déjà quantifiée → l'écart de couleur s'accumule. En usage normal on passe la source APNG en argument ; à noter seulement.
- **loader.py:50 | cosmétique (fuite ressource)** | `Image.open(chemin)` et son `ImageSequence.Iterator` ne sont pas fermés explicitement. CLI court.
- **Grille** : pas d'async ; entrée = 1 argument CLI (pas de client hostile) ; garde `len < 2` empêche de traiter une image fixe comme une animation.

**Verdict : OK** (findings cosmétiques, outil CLI développeur).
