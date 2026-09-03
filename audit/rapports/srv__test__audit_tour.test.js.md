# Rapport d'audit — `srv/test/audit_tour.test.js`

Chemin réel : `/Users/develop/dice-server/test/audit_tour.test.js` — 81 lignes.
Lot annonce **8 fonctions**. Compte réel : **1 helper** (`table`) + **4 cas `test(...)`** = 5 ; le reste (hooks `broadcast/consume/finish`) sont des arrows inline. Écart noté.

Nature : tests `node:test` sur `src/game/match` — vérifient qu'un état lié au tour (longue-vue, effet armé, compteur d'absence) meurt bien avec le tour, même perdu à la pendule.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| `table()` | 22 |
| test « la longue-vue se referme … » | 33 |
| test « un effet arme ne survit pas au tour » | 44 |
| test « meme si un effet survivait … » (async) | 55 |
| test « trois tours sautes … » | 68 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `table` | Monte un `Match` multi 2 humains, `begin()`, le renvoie | hooks stubs sûrs ; CONFIG met les délais à 0 | OK |
| test l.33 / 44 / 68 | Cas synchrones : forcent un état, `playForAway`, assertion, puis `clearTimers()` | timer non libéré **uniquement si l'assertion échoue avant `clearTimers()`** (cosmétique) | OK |
| test l.55 (async) | Vérifie que `pickCell` hors-tour renvoie `'not your turn'` | `await` présent ; `clearTimers()` en fin | OK |

## c) Findings détaillés

Aucune **FAILLE**. Bonne hygiène : chaque test appelle `match.clearTimers()` en fin (grille pt 6 — ressources libérées). Réserve **cosmétique** (grille pt 3/6) : `clearTimers()` étant la dernière instruction, si une `assert` échoue avant, le timer du `Match` n'est pas nettoyé pour ce test — sans impact en production (c'est un test, et l'échec est déjà rapporté par `node:test`). Le test async (l.55) `await`e bien `pickCell`. RAS.
