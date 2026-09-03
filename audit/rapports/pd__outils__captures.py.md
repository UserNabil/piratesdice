# Audit — pd/outils/captures.py (467 lignes)

Fichier lu en entier (3 tranches). Lot annonce **17 fonctions**, **16 nommées + 1 imbriquée (`prendre`) = 17 trouvées** (écart 0). Outil CLI développeur : pilote le simulateur iOS pour prendre les captures de la boutique. Hors runtime jeu.

## (a) Fonctions

| nom | ligne |
|---|---|
| sh | 78 |
| fenetre | 82 |
| _cherche | 108 |
| calibrer | 130 |
| controler_fenetre | 172 |
| _empreinte | 182 |
| bouton_or | 199 |
| _ecart | 258 |
| attendre_calme | 269 |
| point | 282 |
| taper | 294 |
| tenir | 322 |
| photo | 333 |
| au_pont | 360 |
| main | 369 |
| prendre (imbriquée) | 397 |
| doublons_parmi | 450 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| sh | `subprocess.run(shell=True)` | **`shell=True` avec chemins/args interpolés** (`APPAREIL`, `chemin`) : injection possible si `--appareil`/`--sortie` hostiles. Dev contrôle les args. | OK |
| fenetre | position/taille de la fenêtre via osascript | simulateur fermé → `SystemExit` propre ; format osascript inattendu → `ValueError` non attrapé | OK |
| _cherche | balaie une colonne, rend la hauteur qui répond | `_empreinte()` peut être None → `_ecart` renvoie 255 → faux positif possible. Boucle bornée. | OK |
| calibrer | mesure la droite écran↔fenêtre (2 points) | `abs(e2-e1)<1e-6` → return False ; globals mis à jour | OK |
| controler_fenetre | vérifie le rapport portrait | rapport hors bornes → `SystemExit` | OK |
| _empreinte | vignette N&B pour comparer deux écrans | screenshot échoué → renvoie None (géré par `_ecart`). `/tmp/_pd_ecran.png` partagé. | OK |
| bouton_or | trouve le bouton doré par balayage couleur | pas de bande → None (géré) ; `/tmp/_pd_or.png` partagé | OK |
| _ecart | différence moyenne de deux empreintes | **défensif** : None/longueur ≠ → 255 | OK |
| attendre_calme | attend l'immobilité, borné par `plafond` | timeout borné, jamais bloquant | OK |
| point | fraction d'écran → pixel fenêtre | repli sans calibrage (fenêtre=écran) | OK |
| taper | clique et **exige** un changement, jusqu'à `essais` | boucle bornée ; échec → warning, `return False`, ne bloque pas | OK |
| tenir | appui maintenu, rend un lambda de relâchement | **si l'appelant n'appelle pas le lambda, souris reste enfoncée** (fuite d'état). **Actuellement non appelée** (code mort). | OK |
| photo | attend le calme puis screenshot | makedirs ; renvoie bool | OK |
| au_pont | revient au menu quoi qu'il arrive | gestes `attendre=False` qui tombent dans le vide (voulu) | OK |
| main | orchestre le parcours | dépend d'outils externes (osascript/cliclick/xcrun) non vérifiés présents → échecs silencieux, mitigés par détection de changement + `doublons_parmi` | OK |
| prendre | range une capture dans faites/ratées | aucun | OK |
| doublons_parmi | signale les captures identiques | `Image.open` sur PNG absent filtré | OK |

## (c) Findings

- **captures.py:78-79 | cosmétique (sécurité, dev)** | `subprocess.run(cmd, shell=True, ...)` avec `cmd` construit par `%` incluant `APPAREIL` (arg `--appareil`) et `chemin` (dérivé de `--sortie`). Un argument contenant `'` ou `;` casserait la commande / injecterait. Non exploitable en pratique (le développeur fournit ses propres args), mais `shell=False` + liste d'arguments l'éliminerait.
- **captures.py:322-330 | cosmétique (fuite d'état)** | `tenir` rend `lambda: sh("cliclick du:...")` ; si l'appelant oublie de l'appeler, le bouton reste enfoncé. La fonction est **actuellement non utilisée** dans `main` (la cale s'ouvre au clic depuis le 2026-08-27) → code mort à ce jour.
- **captures.py:186,214 | cosmétique** | `/tmp/_pd_ecran.png`, `/tmp/_pd_or.png` : temporaires fixes, course si exécutions concurrentes, incompatibles Windows.
- **Grille** : pas d'async ; entrées = args CLI développeur ; boucles toutes bornées (`plafond`, `essais`) → jamais de blocage ; échecs de clic gérés par re-jeu (`taper`) et signalés (`doublons`).

**Verdict : OK** (findings cosmétiques, outil CLI développeur hors runtime jeu).
