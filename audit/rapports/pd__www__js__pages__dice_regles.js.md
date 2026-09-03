# Rapport d'audit — pd/www/js/pages/dice_regles.js

Fichier lu en entier par tranches (1-200, 200-400, 400-480). Rôle : règles du jeu
(grille, score, effets, Elo) COPIE GÉNÉRÉE de `dice-server/src/game/rules.js` via
`outils/porter_regles.py`. Sert au scoring hors-ligne. Fonctions pures. En-tête :
« NE PAS MODIFIER ICI » — toute divergence silencieuse rejette des parties honnêtes.

## a) Liste des fonctions

| nom | ligne | | nom | ligne |
|---|---|---|---|---|
| emptyGrid | 48 | | clearColumn | 230 |
| columnOf | 52 | | swapCell | 255 |
| cellsOfColumn | 56 | | clearCell | 265 |
| columnValues | 65 | | suivreCase | 291 |
| isColumnFull | 69 | | topCell | 310 |
| isFull | 73 | | moveTop | 333 |
| isEmpty | 77 | | swapQuarters | 359 |
| freeCellInColumn | 81 | | rollDie | 368 |
| place | 88 | | expectedScore | 373 |
| compact | 96 | | ratingDelta | 377 |
| columnScore | 117 | | notesEnJeu | 404 |
| drawQuarters | 153 | | prime | 438 |
| columnScores | 163 | | newRating | 444 |
| totalScore | 169 | | | |
| destroyValueInColumn | 178 | | | |
| destroyMatching | 200 | | | |

Écart de comptage : le lot annonce 46, je recense 29 fonctions nommées + les
arrows inline (map/filter/every/reduce/forEach). Métrique auto sur-comptée. Rien
manqué.

## b) Analyse par fonction

Toutes les fonctions sont PURES (pas d'async, pas de ressource, pas d'état partagé
mutable — chaque grille modifiée passe par `.slice()`), avec bornes défensives.

| nom | rôle | risques | statut |
|---|---|---|---|
| emptyGrid/columnOf/cellsOfColumn/columnValues | grille/colonnes | pas de throw sur entrée validée | OK |
| isColumnFull/isFull/isEmpty/freeCellInColumn | prédicats de grille | `.every`/boucle ; -1 si rien | OK |
| place | pose un dé | `cell<0`→{cell:-1} ; slice | OK |
| compact | tasse la grille | reconstruit | OK |
| columnScore/columnScores/totalScore | score | gardes `opts &&`, `typeof number` ; identique au serveur | OK |
| drawQuarters/rollDie | RNG des quarts et du dé | consomment `rng` dans l'ordre du contrat ; identiques au serveur | OK |
| destroyValueInColumn/destroyMatching/clearColumn/clearCell | destructions | bornes + `Number.isInteger(garde)` | OK |
| swapCell/swapQuarters | échanges | bornes + null-check | OK |
| suivreCase/topCell/moveTop | coque/manœuvre | bornes + retours -1/rate | OK |
| expectedScore/ratingDelta/newRating/notesEnJeu | Elo | gardes result∈{0,.5,1} ; NON exportés (dead côté client) | OK |
| prime | récompense d'une partie | NON exporté (dead côté client) ; DIVERGE du serveur (voir c) | FAILLE (cosmétique) |

## c) Findings détaillés

### FAILLE 1 — copie générée PÉRIMÉE : `prime` a divergé du serveur
- dice_regles.js:438-442 (client) vs dice-server/src/game/rules.js `prime` :
- Gravité : cosmétique (aucun impact runtime aujourd'hui).
- Le serveur porte une branche que la copie client N'A PAS :
  `if (quoi.campagne) return montants.campagne || 0;` (juste après le garde
  `!quoi || !quoi.jouee`). La copie client se contente de `contreIA`/`monte`.
- La copie est donc PÉRIMÉE par rapport à sa source (`porter_regles.py` n'a pas
  été relancé après l'ajout serveur) — exactement l'écart que l'en-tête dit
  vouloir éviter (« deux regles du jeu qui divergent en silence »).
- Impact réel NUL à ce jour : `prime` (et `notesEnJeu`, `expectedScore`,
  `ratingDelta`, `newRating`) ne sont PAS dans la liste `export {}` du client
  (vérifié : exportés = 0) — code mort côté client. De plus le hors-ligne ne
  crédite rien (le serveur tranche au retour). Risque latent seulement si une
  future campagne hors-ligne exportait/utilisait `prime` : elle sous-paierait
  (0 au lieu de `montants.campagne`).

### Invariant critique VÉRIFIÉ (pas de rejet de parties honnêtes)
Comparaison client↔serveur effectuée : constantes IDENTIQUES (COLUMNS=4,
COLUMN_SIZE=3, DIE_FACES=6, BOOST=1.15, CURSE=0.85, QUARTERS=[1.3,1,0.8,0.5]) ;
signatures des 29 fonctions IDENTIQUES ; et surtout TOUTES les fonctions qui
déterminent la suite des coups et le score — `place`, `compact`, `columnScore`,
`columnScores`, `totalScore`, `drawQuarters`, `rollDie`, `destroyMatching`,
`destroyValueInColumn`, `clearColumn`, `clearCell`, `swapCell`, `suivreCase`,
`topCell`, `moveTop`, `swapQuarters` — sont byte-identiques au serveur. La seule
divergence porte sur `prime`, fonction de RÉCOMPENSE non exportée : elle ne touche
NI le score NI l'ordre de consommation du hasard, donc la vérification serveur des
parties hors-ligne n'est pas affectée.

Statut fichier : FAILLES(1) [cosmétique — copie générée périmée (`prime`), sans impact runtime ; cœur déterministe identique au serveur]
