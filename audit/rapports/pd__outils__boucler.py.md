# Audit — pd/outils/boucler.py (111 lignes)

Fichier lu en entier. Lot annonce **7 fonctions**, **6 nommées + 1 imbriquée (`cote`) = 7 trouvées** (écart 0). Outil CLI développeur : fabrique une boucle audio propre à partir d'un WAV qui finit. Hors runtime jeu (produit des .wav livrés avec l'app).

## (a) Fonctions

| nom | ligne |
|---|---|
| lire | 26 |
| ecrire | 31 |
| analyser | 36 |
| normaliser | 52 |
| fin_audible | 56 |
| construire | 67 |
| cote (imbriquée) | 81 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| lire | lit un WAV 16-bit en float | **`w = wave.open(chemin)` jamais fermé** (fuite de handle). Fichier non-WAV → exception non attrapée (CLI). dtype `<i2` supposé ; un WAV non-16-bit donnerait du bruit sans crash. | OK |
| ecrire | écrit un WAV 16-bit | `x.shape[1]` suppose 2D — appelé avec `corps` 2D. `w.close()` présent. Clip appliqué. | OK |
| analyser | flux spectral + chroma | `n<0` si `len(mono)<FEN` → `np.arange` vide (edge). Divisions gardées par `errstate`. | OK |
| normaliser | centre-réduit un vecteur | `+1e-9` évite la division par zéro | OK |
| fin_audible | trouve où commence la fin écrite | fichier silencieux → `niv[niv>-40]` vide → `np.median([])`=nan (warning) → retourne `len(mono)` (repli). | OK |
| construire | choisit le point de coupe, écrit la boucle | **entrée très courte → `range(pmin,pmax)` vide → `rythme/couleur` vides → `np.argmax([])` lève `ValueError`**. Entrées fixes connues (2 WAV du menu/partie), mais crash possible. | OK |
| cote | centre-réduit local | vecteur vide → nan | OK |

## (c) Findings

- **boucler.py:84 | cosmétique (crash, outil dev)** | `best = pmin + int(np.argmax(total))` — si l'entrée est plus courte que la fenêtre d'analyse, `total` est vide et `np.argmax` lève `ValueError: attempt to get argmax of an empty sequence`. Les deux entrées réelles (`Tavern_Waltz.wav`, `Windswept_Return.wav`) sont longues, donc non atteint en pratique.
- **boucler.py:27 | cosmétique (fuite ressource)** | `w = wave.open(chemin)` sans `w.close()` : handle laissé ouvert (contrairement à `ecrire` qui ferme). CLI court.
- **Grille** : pas d'async ; entrées = 2 fichiers fixes codés dans `__main__` (pas de client hostile) ; calcul numériquement gardé (`+1e-9`, `errstate`).

**Verdict : OK** (findings cosmétiques, outil CLI développeur à entrées fixes).
