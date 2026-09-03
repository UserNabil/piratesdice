# Audit — srv/test/enligne.test.js (308 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **31 fonctions**,
**~31 comptées** (helpers `socket`/`send`/`close`/`on`/`ping`/`terminate`/`dernier`/
`joueur`/`ranger` + 6 stubs `store.*` (arrows) + 11 rappels `test` + arrows inline
`.map`/`.filter`/`.reduce`. Cohérent au comptage des `=>`).

## (a) Fonctions

| nom | ligne |
|---|---|
| stubs `store.getPlayer`/`inventory`/`catalog`/`settleMatch`/`compteursDe`/`remettreJetons` | 25-34 |
| `socket` (+ méthodes `send`/`close`/`on`/`ping`/`terminate`) | 38 |
| `dernier` | 47 |
| `joueur` | 52 |
| `ranger` | 64 |
| test « deux inconnus s apparient, la file se vide » | 69 |
| test « un compte ne s affronte pas lui-meme » | 84 |
| test « rejouer contre le meme : refuse puis accepte » | 99 |
| test « le salon prive s ouvre, assied, et SURVIT » | 120 |
| test « un tiers ne ferme pas le salon d un autre » | 148 |
| test « six joueurs font trois tables » | 162 |
| test « une socket morte ne bloque pas ceux qui suivent » | 186 |
| test « un intrus refuse ne vole pas la place de l ami » | 208 |
| test « le salon survit a la reconnexion de l ami » | 234 |
| test « rejoindre un salon libere la table tenue ailleurs » | 261 |
| test « le reglement d une vieille table ne debarque pas… » | 289 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| stubs `store.*` | remplacent les LECTURES base par des async fixes | **mutation du singleton `store`** (voir findings) ; OK ici car node:test isole chaque fichier dans un process | OK (note) |
| `socket`/`dernier`/`joueur`/`ranger` | fausses sockets, dernier message d'un type, session câblée, nettoyage timers | `ranger` vide les timers de match + `heartbeat` | OK |
| l.69-198 (7 tests) | VRAI `Gateway` : appariement, anti-self-match, rematch après patience, salon privé (create/join/relancer/cancel/roomfail), tiers, 6→3 tables sans double-siège, socket morte sautée | **try/finally → `ranger` garanti** ; assertions fortes et exactes | OK |
| l.208-308 (4 tests) | intrus refusé, survie reconnexion, libération de table, settle sans clobber | mêmes assertions fortes MAIS **`ranger(gw)` hors try/finally** (voir findings) | OK (note fuite conditionnelle) |

## (c) Findings

- Aucun test faussement vert : le VRAI `Gateway` est instancié (pas imité), seules
  les lectures base sont stubbées ; les assertions vérifient l'état réel
  (`a.match === b.match`, `queue.length`, `rooms.has(code)`, `roomfail.msg`,
  répartition des sièges). Excellente couverture de la couche en-ligne, jusque-là nue.
- **enligne.test.js:208-308 | fuite ressource (chemin d'échec seulement)** : les 4
  derniers tests appellent `ranger(gw)` en DERNIÈRE ligne, **sans `try/finally`**,
  contrairement aux 7 premiers. Les `Match` créés par `engager`/`onPlay` posent des
  timers `later()` qui ne sont **pas `unref()`'d** (match.js:306-311). Si une
  assertion de ces tests échoue, `ranger` n'est pas atteint → timers de match
  pendants qui gardent le process node:test vivant (callbacks gardés, pas de crash).
  Sur suite verte : aucun effet. Incohérence de rigueur à aligner sur les 7 premiers.
- **enligne.test.js:24-34 | fragilité (pas un bug ici)** : `store.getPlayer = …` etc.
  **écrasent le module `store` en global** pour tout le process. Sûr uniquement parce
  que `node --test` lance un process par fichier ; un jour où deux fichiers
  partageraient un process, ces stubs contamineraient l'autre. À connaître.
- **enligne.test.js:114 | cosmétique** | `enFileDepuis = Date.now() - 7000` couplé à
  `PATIENCE_REMATCH_MS=6000` (7000>6000). Déterministe (offset relatif), non flaky ;
  casserait si on relève la patience au-delà de 7 s.
- Async correctement `await`és ; pas de `setTimeout` attendu dans les tests eux-mêmes.

**Verdict : OK (2 notes : fuite timers conditionnelle sur les 4 derniers tests ;
mutation globale de `store`)**
