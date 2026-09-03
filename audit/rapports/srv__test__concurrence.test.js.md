# Rapport d'audit — `srv/test/concurrence.test.js`

Chemin réel : `/Users/develop/dice-server/test/concurrence.test.js` — 276 lignes.
Lot annonce **29 fonctions**. Compte réel : **1 helper** (`table`) + **13 cas `test(...)`** = 14 ; le reste sont des arrows (hooks `broadcast`/`consume`/`finish`, exécuteurs de `Promise`, `.filter`/`.map`). Écart noté.

Nature : tests `node:test` sur `src/game/match` (et un sur `src/gateway`) qui éprouvent la **simultanéité réelle** : deux commandes partent avant que la première soit résolue (`Promise.all`, `match.serialize`, `setImmediate`). Deux tests inspectent le SOURCE (`store.js`, `sql/027`) plutôt que de monter Postgres, et l'annoncent.

## a) Liste des fonctions

| nom | ligne | | nom | ligne |
|-----|-------|-|-----|-------|
| `table(caps)` | 39 | | test C bis (fin normale + abandon) | 168 |
| test A (deux placeDice) | 69 | | test E (turnId avance/ne recule pas) | 184 |
| test A bis (même commandId) | 88 | | test E bis (saut pendule → turnId) | 204 |
| test A ter (registre borné) | 99 | | test D (double table refusée) | 216 |
| test B (deux useBonus) | 110 | | test F (clause SQL présente) | 241 |
| test B bis (deux pickFace) | 133 | | test F bis (migration 027 rejouable) | 265 |
| test C (timeout + abandon) | 151 | | | |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `table` | Monte un `Match` multi ; `consume` async avec `setImmediate` pour recréer la fenêtre réseau | hooks sûrs ; aucun timer long | OK |
| tests A/B (async) | `Promise.all` de deux commandes concurrentes → une seule action | `await` présent, assertions bornées | OK |
| test A ter | Vérifie que `match.commandes` reste ≤256 (anti-fuite mémoire) | prouve justement l'absence de fuite | OK |
| tests C (sync) | Double règlement (timeout+abandon) → un seul `finish` | synchrone | OK |
| tests E (sync) | `turnId` monotone, présent dans l'instantané | synchrone | OK |
| test D | Monte un vrai `Gateway`, vérifie `trouverTableVivante`, puis `g.close()` | `g.close()` hors try/finally (voir C1) | OK |
| tests F/F bis | Recherchent des clauses dans `store.js` / `sql/027` par `fs.readFileSync` | lecture synchrone, pas de handle laissé | OK |

## c) Findings détaillés

Aucune **FAILLE** de production. Points relevés :

### C1 — `g.close()` hors `try/finally` dans le test D (cosmétique, hygiène de test)
`srv/test/concurrence.test.js:224-239` — Le test D instancie un **vrai** `Gateway` (`new Gateway()`) et appelle `g.close()` en **dernière** instruction (l.238). Si une des assertions (l.233-237) échoue avant, `g.close()` n'est pas appelé : si le constructeur de `Gateway` détient une ressource (intervalle de ménage, socket), elle fuit et pourrait maintenir la boucle d'événements ouverte, retardant/bloquant `node --test`. Contrairement aux tests à pendule de `bonus_unique.test.js`, celui-ci n'utilise pas `try { … } finally { g.close(); }`. Impact strictement **cosmétique / test** (ne se manifeste que sur un test déjà en échec). Grille pt 6.

### Corroboration (pas une faille) — le fichier confirme la dépendance d'idempotence de `migrate.js`
`srv/test/concurrence.test.js:265-275` — Le test F bis vérifie explicitement que `sql/027` est rejouable (`CREATE SEQUENCE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `WHERE rang IS NULL`) et son commentaire l.270-271 énonce mot pour mot le risque relevé dans le rapport de `srv/src/migrate.js` (F2) : « migrate.js rejoue TOUS les fichiers a chaque deploiement : une migration qui n'est pas idempotente casse le deploiement suivant. » Le dépôt est donc conscient de la contrainte et la teste **par migration** — mais il n'existe (cf. rapport migrate.js) aucun test générique la garantissant sur les 31 fichiers.
