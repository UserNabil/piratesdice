# Rapport d'audit — srv/src/game/bonus.js

Fichier : `/Users/develop/dice-server/src/game/bonus.js` (544 lignes)
Métrique lot : 52 fonctions. **Compte réel : ~41 méthodes nommées** (les 16 specs B001..B016 avec leurs `check`/`apply`/`checkCell`/`checkPremiere`/`faces`, plus `get`). L'écart avec 52 vient des arrow-callbacks internes (`every`/`filter`/`includes`).

## a) Liste des fonctions (nom | ligne)

B001.check 10, B001.apply 14 | B002.check 27, B002.apply 31 | B003.check 43, B003.apply 47 | B004.check 71, B004.apply 75 | B005.check 90, B005.apply 95 | B006.check 108, B006.checkCell 122, B006.apply 141 | B007.check 153, B007.apply 161 | B008.check 181, B008.apply 196 | B009.check 210, B009.checkCell 216, B009.apply 222 | B010.check 248, B010.checkCell 254, B010.apply 260 | B011.check 296, B011.apply 303 | B012.check 336, B012.faces 341, B012.apply 347 | B013.check 380, B013.apply 384 | B014.check 412, B014.checkPremiere 424, B014.checkCell 430, B014.apply 437 | B015.check 473, B015.apply 478 | B016.check 511, B016.checkPremiere 521, B016.checkCell 522, B016.apply 529 | get 540

## b) Grille par fonction (groupée par effet)

| effet | rôle | risques | statut |
|-------|------|---------|--------|
| B001 relance | retire un dé/le retire de la file | `takeDie` fallback `rollDie` ; pas d'entrée cell | OK |
| B002 nettoie sa case | efface un dé chez soi | `clearCell` borne cell ; `!res.ok`→null | OK |
| B003 canon | détruit un dé adverse | coque gérée ; `clearCell` borne | OK |
| B004 longue-vue | ouvre la vue | drapeau simple | OK |
| B005 bénédiction | bénit une colonne | `columnOf` puis borne `col` | OK |
| B006 gel colonne | gèle une colonne adverse | `checkCell` borne via isColumnFull (col hors borne→"pleine", refus propre) ; apply borne col | OK |
| B007 saut de tour | vole le prochain tour | drapeau unique | OK |
| B008 presse | raccourcit le tour d'en face | garde `config.awayMs` + IA sans pendule | OK |
| B009 échange | troque deux dés face à face | `checkCell` indexe `grids[seat][cell]` direct ; `apply` via `swapCell` (borné) | OK (cell validé amont) |
| B010 bordée | rase la colonne des deux camps | apply borne col ; coque `garde` par camp | OK |
| B011 malédiction | maudit une colonne adverse | apply borne col | OK |
| B012 dé pipé | déplace la face d'un cran | `faces()` borne 1..DIE_FACES ; `apply` refuse une face hors `faces` | OK |
| B013 brouillard | annule la prochaine destruction subie | drapeau | OK |
| B014 manœuvre pont | déplace le dé du sommet | `moveTop` borne depuis/vers ; coque suivie | OK |
| B015 coque | protège un dé un tour | `apply` indexe `grids[seat][cell]` direct ; refuse vide | OK (cell validé amont) |
| B016 changement de quart | échange deux quarts | `swapQuarters` borné ; refuse quarts égaux | OK |
| get | résout un spec par identify | `hasOwnProperty` — pas de prototype pollution | OK |

## c) Findings détaillés

Aucune FAILLE isolée dans bonus.js. Points de vigilance :

- **Dépendance de validation `cell`/`face` sur l'appelant.** Plusieurs specs indexent directement la grille avec `cell` (B009.checkCell ligne 216-217, B015.apply ligne 479) ou passent `cell` à des helpers `rules.*` dont la borne `< 0 || >= CELLS` **ne rejette PAS un non-entier** (ex. `clearCell` : `grid[1.5] === null` est faux, donc passe — voir rapport rules.js). bonus.js ne fait AUCUNE vérification `Number.isInteger(cell)`. La sûreté repose entièrement sur les appelants : `Match.pickCell` valide `Number.isInteger(cell) && 0 <= cell < CELLS` (match.js:946), `Match.place` valide la colonne (match.js:595), et `Match.aiBonus` valide `Number.isInteger(plan.cell/premiere/face)` (match.js:1387,1393,1403). **`horsligne.js:186` appelle aussi `bonusCatalog.get(c.b)` puis `apply`** — j'ai vérifié (voir rapport horsligne.js) qu'il rejoue un journal serveur (cases déjà validées à l'enregistrement), pas une entrée client directe. Tant que cette invariant tient, aucune entrée hostile n'atteint un index non borné ici. **Si un futur appelant oubliait cette validation, B009/B015 et les `clearCell`/`swapCell` accepteraient un `cell` fractionnaire** (effet cosmétique : fx `destroy`/`troc` sur un index fantôme, comptabilisé par bilan sans rien détruire).
- Aucun `setTimeout`/`later`/async dans ce fichier : pas de callback différé à protéger ici (ils vivent dans match.js).
- `BONUS` est une table constante partagée en lecture seule ; les `apply` mutent l'objet `match` passé, jamais `BONUS` — pas d'état partagé cassable entre parties.

## Verdict
OK (0 FAILLE) — sous réserve que tout appelant valide `cell`/`face` en entier borné, ce que font match.js et horsligne.js dans le dépôt actuel.
