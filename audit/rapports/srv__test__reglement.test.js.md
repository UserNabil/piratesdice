# Audit — srv/test/reglement.test.js (309 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **25 fonctions**,
**~25 comptées** (`baseDePoche`, `query`(méthode), `chargerStore`, `partie`, `duel`
+ 11 rappels `test` + arrows des stubs db (`connect`/`q`/`one`/`tx`/`release`) et
`.forEach`/`.map`/`.some`. Cohérent au comptage des `=>`).

## (a) Fonctions

| nom | ligne |
|---|---|
| `baseDePoche` | 30 |
| `client.query` (méthode) | 44 |
| `chargerStore` | 121 |
| `partie` | 132 |
| test « une fin de partie va au bout » | 142 |
| test « les compteurs derives sont recalcules » | 161 |
| test « un haut fait ouvert OUVRE, il ne paie plus » | 172 |
| test « recuperer paie une fois, le second appel rien » | 192 |
| test « un identifiant que le joueur n a pas ne paie rien » | 219 |
| test « un siege sans compteurs ne casse rien » | 232 |
| `duel` | 251 |
| test « une partie en ligne menee au bout compte pour les deux » | 270 |
| test « une partie contre la machine n ouvre aucun capitaine » | 278 |
| test « une table quittee AVANT d avoir joue ne compte pour personne » | 285 |
| test « un rage quit : celui qui RESTE compte » | 293 |
| test « une deconnexion se lit comme un abandon » | 303 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `baseDePoche` / `client.query` | fausse DB qui répond aux requêtes précises du règlement ; **honore le 7e paramètre `games`** au lieu d'incrémenter toujours | conception exemplaire : le mock ne triche pas (voir en-tête l.49-54) ; mais couplé au TEXTE SQL par regex (voir findings) | OK (note) |
| `chargerStore` | injecte `poche.module` comme `../src/db` dans `require.cache`, require `store` frais, puis re-purge le cache | isolation propre : chaque test a son store lié à sa propre DB de poche ; re-exécute le top-level de store.js à chaque appel (voir findings) | OK (note) |
| l.142-242 | VRAI `store.settleMatch`/`reclamerSucces` : bourse+note+hauts faits, **compteurs dérivés** (le test qui aurait attrapé le bug de shadowing), ouverture sans paiement, **récolte idempotente** (2e appel paie 0 → anti-création de monnaie), identifiant non dû = 0, siège sans compteurs | assertions **exactes** sur `games`/`wins`/`coins`/`tallies`/`ledger` ; le contraire d'un test faussement vert | OK |
| `duel` / l.270-309 | matrice « qu'est-ce qui compte comme partie » sur la VRAIE transaction : en ligne complet = les deux, solo = personne, quit avant jeu = personne, rage quit = le restant, déconnexion = le bon côté | assertions exactes sur `games` de chaque joueur | OK |

## (c) Findings

- Aucun test faussement vert — au contraire, ce fichier EST le correctif du
  problème « 124 tests verts pendant que `settleMatch` était cassé ». Il teste la
  VRAIE transaction (`store.settleMatch`) contre une DB de poche qui honore les
  paramètres, avec des assertions concrètes sur l'état écrit. Le test l.161-170
  (compteurs dérivés) est la régression exacte du bug de shadowing du module `succes`.
- **reglement.test.js:44-108 | fragilité (couplage au texte SQL)** : la DB de poche
  route par **regex sur le texte des requêtes** (`/UPDATE player/`, `/INSERT INTO match/`,
  …). Si `store.js` reformule une requête au point de ne plus matcher, la branche
  tombe sur `return { rows: [] }` : selon la tolérance du code appelant, une
  régression pourrait alors passer inaperçue (le mock répond « rien » sans lever).
  En pratique les assertions d'état la rattraperaient le plus souvent (ex. `games`
  non incrémenté = échec réel), mais le couplage texte↔mock est à surveiller à
  chaque modification SQL.
- **reglement.test.js:121-130 | cosmétique** | `chargerStore` re-require `src/store`
  à chaque test → réexécute son code top-level. Sûr tant que le db est stubbé
  (`pool.connect` factice) ; à connaître si store.js gagne un effet de bord au load.
- **Timing** : `startedAt: Date.now() - 60000` (offset relatif) → déterministe, non
  flaky. Tous les async correctement `await`és.

**Verdict : OK (notes : mock DB couplé au texte SQL ; re-require de store par test)**
