# Rapport d'audit — srv/src/game/eval.js

Fichier : `/Users/develop/dice-server/src/game/eval.js` (166 lignes)
Métrique lot : 15 fonctions. **Compte réel : 10 fonctions nommées + arrows** (`.map((w) => …)`, `.every((w) => …)` ligne 158-159) ≈ 12. Écart = arrows/approximation.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| columnCounts | 57 |
| pairPotential | 70 |
| exposure | 81 |
| safeScore | 97 |
| emptyCells | 105 |
| features | 115 |
| dot | 137 |
| evaluate | 143 |
| terminalValue | 148 |
| sanitizeWeights | 156 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| columnCounts | compte les valeurs d'une colonne | `grid` doit être un tableau (grille moteur) | OK |
| pairPotential | potentiel de paires d'une grille | boucle bornée `rules.COLUMNS` | OK |
| exposure | espérance de destruction adverse | idem | OK |
| safeScore | points devenus indestructibles | idem | OK |
| emptyCells | compte les cases vides | borné `rules.CELLS` | OK |
| features | vecteur de traits vu par `seat` | `grids[seat]` suppose seat∈{0,1} (serveur) ; div. par NORME_* (constantes non nulles) | OK |
| dot | produit scalaire poids×vecteur | garde `weights[i] \|\| 0` | OK |
| evaluate | évaluation d'une position | `weights \|\| DEFAULT_WEIGHTS` | OK |
| terminalValue | valeur d'une position terminée | pur | OK |
| sanitizeWeights | valide un jeu de poids appris | valide type/longueur/finitude/borne 1e4 | OK (bonne défense) |

## c) Findings détaillés

Aucune FAILLE.

Notes de vigilance :
- Module **purement calculatoire** de l'IA : aucun `await`, aucun timer, aucun état mutable partagé, aucune entrée client directe (grids/turn/seat viennent du moteur, weights de la base d'entraînement).
- **`sanitizeWeights` (ligne 156) est le point de défense contre des poids appris corrompus** chargés depuis la DB : il rejette tableau de mauvaise longueur, valeurs non finies (NaN/Infinity) et |w|≥1e4. Bien fait — c'est ce qui empêche un jeu de poids douteux de propager des NaN dans `dot`/`evaluate`.
- Aucune division par zéro possible : `NORME_SCORE`/`NORME_PAIRE`/`CELLS_POUR_NORMALISER` dérivent de `rules.CELLS` (constante ≥ 9, jamais 0).
- `features` suppose `seat ∈ {0,1}` ; hors bornes, `grids[seat]` serait `undefined` et `rules.totalScore(undefined)` jetterait. `seat` est assigné côté moteur/serveur, pas lu du client.

## Verdict
OK (0 FAILLE).
