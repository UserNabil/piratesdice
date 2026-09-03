# Audit — srv/test/rules.test.js (145 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **17 fonctions**,
**~16 trouvées** (écart 1 : 13 rappels `test` + comparateur `(a,b)=>a-b` l.48 +
2 stubs de dé `()=>0` / `()=>0.999999` l.76-77. La métrique auto est approximative ;
écart signalé, non bloquant).

## (a) Fonctions

| nom | ligne |
|---|---|
| test « a die falls into the first free slot » | 7 |
| test « a column scores value x count squared » | 19 |
| test « the total is the sum of every column » | 28 |
| test « placing destroys every matching enemy die… » | 40 |
| test « destruction compacts the column… » | 53 |
| test « clearing a cell compacts and refuses… » | 63 |
| test « the die only ever rolls 1 to 6 » | 72 |
| test « elo moves both players by the same amount… » | 80 |
| test « a stronger player gains less… » | 88 |
| test « les trois quarts du pont ponderent… » | 94 |
| test « la benediction majore un score DEJA pondere » | 106 |
| test « les quarts sont une PERMUTATION… » | 116 |
| test « the AI keeps its cannon… » | 131 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| l.7-70 (grille) | pose/colonne-pleine, `columnScore` (v×n²), `totalScore`, `destroyMatching` (destruction + compactage), `clearCell` | VRAI module `src/game/rules` ; assertions exactes (`strictEqual`/`deepStrictEqual`) ; l.34 lit `rules.COLUMNS` au lieu de coder « 3 » en dur (bonne pratique explicitée) | OK |
| l.72 `rollDie` | 5000 tirages doivent couvrir 1..6 ; puis 2 tirages déterministes via RNG injecté | **dépendance à l'aléa** : couvrir 1..6 en 5000 tirages est quasi-certain (P(manque)≈6·(5/6)^5000≈0), pas flaky en pratique ; les 2 assertions déterministes fixent bien les bornes | OK (note) |
| l.80-92 (elo) | `ratingDelta` symétrique, hors-borne → `null`, favori gagne moins | assertions exactes ; `strong < weak` est une inégalité (moins stricte qu'une valeur) mais correcte | OK |
| l.94-114 (quarts/bénédiction) | multiplicateur par colonne, ordre quart-puis-bénédiction (l.112 recalcule l'attendu avec `Math.round` imbriqués) | l'attendu est dérivé de la formule, pas codé en dur : bon | OK |
| l.116 `drawQuarters` | 40 tirages `Math.random`, chacun doit être une **permutation** de `QUARTERS` | **invariant vrai pour TOUTE sortie** → non flaky malgré l'aléa | OK |
| l.131 (IA garde son canon) | `ai.bonusPlan` : ne gâche pas B003 si la pose emporte déjà la colonne, mais l'utilise sinon | VRAI module `src/game/ai` ; deux assertions (avec le bon dé / avec un autre) ; l.140 tolère `!avecLeBonDe` OU `identify!=='B003'` (correct : l'absence de plan est aussi une réussite) | OK |

## (c) Findings

- Aucun test faussement vert : tout appelle les **vrais** modules `src/game/rules`
  et `src/game/ai` avec des assertions présentes et pour l'essentiel exactes.
- Pas d'async, pas de `setTimeout`, pas de dépendance temporelle réelle.
- **rules.test.js:72-75 | cosmétique** | test statistique à 5000 tirages : robuste
  mais non déterministe. Aucun `seed` — si `rollDie` régressait vers un biais fort
  (ex. ne sort jamais 3), il serait détecté ; s'il sortait 3 rarement mais > 0 fois,
  il passerait. Marge largement suffisante ; noté par exhaustivité.

**Verdict : OK**
