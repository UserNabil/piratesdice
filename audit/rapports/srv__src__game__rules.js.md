# Rapport d'audit — srv/src/game/rules.js

Fichier : `/Users/develop/dice-server/src/game/rules.js` (451 lignes)
Métrique lot : 46 fonctions. **Compte réel : 34 fonctions nommées** + arrow-callbacks (`map`/`filter`/`every`/`reduce`). Écart = arrows.

## a) Liste des fonctions (nom | ligne)

emptyGrid 37 | columnOf 41 | cellsOfColumn 45 | columnValues 54 | isColumnFull 58 | isFull 62 | isEmpty 66 | freeCellInColumn 70 | place 77 | compact 85 | columnScore 106 | drawQuarters 142 | columnScores 152 | totalScore 158 | destroyValueInColumn 167 | destroyMatching 189 | clearColumn 219 | swapCell 244 | clearCell 254 | suivreCase 280 | topCell 299 | moveTop 322 | swapQuarters 348 | rollDie 357 | expectedScore 362 | ratingDelta 366 | notesEnJeu 393 | prime 427 | newRating 437

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| emptyGrid | grille vide | pur | OK |
| columnOf | colonne d'une case | **pas de borne** : cell hors plage → col hors plage (appelants bornent col ensuite) | OK |
| cellsOfColumn | cases d'une colonne | col hors plage → indices hors plage (lecture `undefined`, pas de throw) | OK |
| columnValues | valeurs d'une colonne | idem | OK |
| isColumnFull | colonne pleine ? | col hors plage → `[undefined]`.every(v!==null) → **true** (fail-safe côté "refus") | OK |
| isFull / isEmpty | grille pleine/vide | `grid.every` — jette si grid non-array (serveur) | OK |
| freeCellInColumn | 1re case libre | interne | OK |
| place | pose dans une colonne | col via appelant borné | OK |
| compact | tasse la grille | reconstruit sur indices entiers → ignore indices fantômes | OK |
| columnScore | score pondéré d'une colonne | opts gardés `typeof`/`===` | OK |
| drawQuarters | tire les quarts | Fisher-Yates borné | OK |
| columnScores / totalScore | scores/total | cols internes | OK |
| destroyValueInColumn | détruit une valeur dans une colonne | **col non borné**, mais AUCUN appelant dans le dépôt (effet retiré) | OK (mort) |
| destroyMatching | destruction par correspondance | `garde` via Number.isInteger ; cols internes | OK |
| clearColumn | rase une colonne | borne `col` (l.220) | OK |
| swapCell | échange une case | borne `cell<0/>=CELLS` mais **pas Number.isInteger** | OK (cell validé amont) |
| clearCell | efface une case | borne `cell` mais **pas Number.isInteger** | OK (cell validé amont) |
| suivreCase | recalcule une case après tassement | borne cell | OK |
| topCell | dé du sommet | borne col | OK |
| moveTop | déplace le sommet | borne depuis/vers | OK |
| swapQuarters | échange deux quarts | borne a/b | OK |
| rollDie | tire un dé | `Math.min` borne | OK |
| expectedScore | Elo attendu | pur ; coercition numérique | OK |
| ratingDelta | delta Elo | valide `result ∈ {0,0.5,1}` | OK |
| notesEnJeu | qui voit sa note bouger | lit `a.games`/`b.rating` sans garde null (états serveur) | OK |
| prime | or d'une partie | garde `quoi` | OK |
| newRating | nouvelle note | delta null-check ; `Math.max(0,…)` | OK |

## c) Findings détaillés

Aucune FAILLE exploitable. Points de vigilance :

- **Borne de `cell` sans vérification d'entier** (`clearCell` l.254-255, `swapCell` l.244-246). Le test `cell < 0 || cell >= CELLS` laisse passer un non-entier (ex. `1.5`) car `grid[1.5]` vaut `undefined` (≠ `null`). L'effet resterait cosmétique (`compact` reconstruit sur les indices entiers, donc rien n'est réellement détruit/échangé ; seul un `fx` porterait un index fantôme). **Non atteignable** dans le dépôt actuel : `Match.pickCell` (match.js:946) et `Match.aiBonus` (match.js:1393) valident `Number.isInteger(cell)` en amont. À aligner par cohérence si l'on veut une défense en profondeur.
- **`destroyValueInColumn`** (l.167) n'a plus aucun appelant (premier trait de Barbe-Noire retiré) — code mort, sans borne sur `col` ; à supprimer ou border si jamais réutilisé.
- Module sans async, sans timer, sans état mutable partagé (toutes les fonctions rendent de nouvelles grilles via `slice()`/`compact` ; aucune ne mute son argument). Deux appels concurrents ne partagent rien.

## Verdict
OK (0 FAILLE).
