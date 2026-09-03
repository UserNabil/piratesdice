# Rapport — srv/src/game/search.js (436 lignes)

Moteur de recherche IA : expectimax à profondeur itérative sous budget de temps, en chemin rapide Int8Array (double de rules.js/eval.js pour la vitesse). Alterne nœuds de décision (colonnes) et de hasard (6 faces), avec table de transposition.

## a) Fonctions (nom | ligne)
- `toFast` | 37
- `toRules` | 43
- `columnFull` | 49
- `gridFull` | 53
- `columnScore` | 70
- `totalScore` | 95
- `columnPotential` | 106
- `potential` | 118
- `exposure` | 132
- `emptyCells` | 140
- `safeScore` | 147
- `fastFeatures` | 156
- `applyMove` | 175
- `legalColumns` | 199
- `fillPow7` (IIFE) | 221
- `packer` | 226
- `positionKey` | 232
- `Search.constructor` | 237
- `Search.tick` | 249
- `Search.evaluate` | 253
- `Search.terminal` | 263
- `Search.orderingGain` | 272
- `Search.decision` | 298
- `Search.chance` | 339
- `Search.run` | 358
- `bestMove` | 419

**Écart de comptage** : 26 fonctions/méthodes recensées contre 50 annoncées au lot. L'écart vient de la métrique auto qui compte les arrow-functions inline (`.map((c) => …)`, `.map((c,i)=>…)`, `.sort((x,y)=>…)` en L308-310) et probablement les nombreuses expressions courtes ; il n'y a pas de fonction cachée non lue. Fichier lu en entier (2 tranches).

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| toFast | Array grid → Int8Array (null→0) | si `grid` null/undefined → TypeError à l'indexation ; entrée serveur (état de partie), pas client direct | OK |
| toRules | Int8Array → Array (0→null) | pure | OK |
| columnFull | colonne pleine ? | pure, bornes fixes | OK |
| gridFull | plateau plein ? | pure | OK |
| columnScore | score d'une colonne (×quart) | lit `QUARTS` module ; si `QUARTS[col]` non-numérique → NaN propagé (pas de crash). QUARTS validé en amont (voir bestMove) | OK |
| totalScore | somme sur COLUMNS | pure | OK |
| columnPotential | potentiel d'une colonne non pleine | idem QUARTS | OK |
| potential | somme des potentiels | pure | OK |
| exposure | pertes exposées à l'adversaire | pure | OK |
| emptyCells | nb de cases vides | pure | OK |
| safeScore | points acquis | pure | OK |
| fastFeatures | vecteur de 11 features sans allouer | `out` réutilisé (scratch d'instance) — pas de concurrence en mono-fil | OK |
| applyMove | applique un coup, alloue 2 Int8Array | pure sur ses entrées | OK |
| legalColumns | colonnes jouables | pure | OK |
| fillPow7 | remplit POW7 (IIFE au chargement) | s'exécute une fois, borné par CELLS | OK |
| packer | encode un plateau en Float64 base 7 | 7^12≈1,4e10 < 2^53 exact (documenté) ; pas de collision de clef | OK |
| positionKey | clef "packer(g0):packer(g1)" | pure | OK |
| Search.constructor | initialise budget/profondeur/tables | `opts` null toléré (valeurs par défaut) | OK |
| Search.tick | jette OutOfTime au-delà du deadline | throw contrôlé, attrapé dans run() | OK |
| Search.evaluate | score linéaire des poids | pure ; NaN si poids/features NaN (pas de crash) | OK |
| Search.terminal | valeur terminale (gagné/perdu) | pure | OK |
| Search.orderingGain | gain immédiat pour ordonner | pure | OK |
| Search.decision | nœud de décision alpha-beta | appelle tick (peut throw OutOfTime) → remonte jusqu'au try de run | OK |
| Search.chance | nœud de hasard + cache transposition | cache borné à 900000 (tableSize) ; instance jetée après run | OK |
| Search.run | recherche à profondeur itérative | try/catch cible `OutOfTime`, rejette le reste ; boucle bornée par maxDepth et deadline | OK |
| bestMove | pose QUARTS, lance une Search, remet QUARTS=null en finally | voir finding #1 (état module partagé) | OK sous hypothèse mono-fil |

## c) Findings
Aucune faille bloquante. Observations à faible risque :

1. **État de module partagé `QUARTS` (L68, posé en L419-423, remis à null en finally L426-428)** — gravité : état incohérent (théorique). `bestMove` écrit une variable de module puis la remet à null dans un `finally`. C'est sûr tant que le moteur reste **mono-fil et non ré-entrant** (hypothèse assumée et documentée L64-67). Aucun `await` dans tout le chemin de recherche, donc pas d'entrelacement possible : pas de faille réelle en Node. À surveiller uniquement si un jour `run` devenait asynchrone.

2. **Validation d'entrée de `QUARTS` centralisée dans `bestMove` (L423)** — `(Array.isArray(quarts) && quarts.length >= COLUMNS) ? quarts : null`. Rejette bien un tableau trop court ou non-tableau, mais **pas** un tableau de la bonne longueur contenant des valeurs non numériques (→ scores NaN, choix de colonne arbitraire, jamais de crash). Les quarts proviennent de l'état de partie serveur, pas du client : risque faible.

3. **`bestMove` peut relancer une exception non-`OutOfTime`** vers l'appelant (via `run`), ex. TypeError si `grids` malformé (L360-361 `toFast`). Ce chemin dépend d'un état de partie serveur valide ; la robustesse repose sur l'appelant (à vérifier côté gateway/consommateur IA). Pas une faille de ce fichier.

Statut : OK
