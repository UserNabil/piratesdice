# Rapport d'audit — `srv/stress2.js`

Chemin réel : `/Users/develop/dice-server/stress2.js` — 34 lignes.
Lot annonce **14 fonctions**. Compte réel : **1 fonction nommée** (`partie`) + ~13 arrows inline (handler `uncaughtException`, `.map`, les 5 hooks l.11, `later` l.15, prédicat `.filter`…). Écart attendu (métrique gonflée par les `=>`), noté, pas bloquant.

Nature : **script de stress / diagnostic hors-ligne** (`node stress2.js`), pas du code serveur ni du runtime de partie. La gravité de tout finding est donc plafonnée à **cosmétique / outil de test**.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| handler `process.on('uncaughtException', …)` | 6 |
| arrow `c => c.id` (`.map`) | 7 |
| `partie(capIA, sansTrait)` | 8 |
| hooks `weights/broadcast/consume/balance/finish` | 11 |
| `m.later = (fn) => {…}` | 15 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| handler `uncaughtException` | Consigne toute exception non captée dans `erreurs[]` | `e.stack.split('\n')` suppose `e.stack` défini ; un throw synchrone n'y « reprend » pas la boucle | OK (cosmétique) |
| `partie` | Joue une partie solo IA vs greedy, cap 600 tours, renvoie l'anomalie (`GELE`/`BOUCLE`) ou `null` | Appels `m.roll/m.place/m.driveAi` non entourés de try/catch : un throw remonte hors des boucles l.27-31 | OK (cosmétique) |
| `m.later` (override) | Exécute le callback différé immédiatement, protégé par try/catch qui pousse dans `erreurs[]` | aucun | OK |
| hooks (l.11) | Stubs de test (`consume:async()=>true`, `finish` capture l'issue) | aucun | OK |

## c) Findings détaillés

Aucune **FAILLE** au sens du protocole (pas de code serveur/partie ; c'est un harnais). Deux points cosmétiques signalés pour mémoire :

### C1 — Un throw pendant la boucle de jeu avorte tout le run (cosmétique)
`srv/stress2.js:17-23` puis `:27-31` — Dans `partie`, `m.roll`, `m.place`, `m.driveAi`, `ai.chooseColumn` ne sont pas protégés. S'ils jettent, l'exception remonte hors de `partie` et des trois boucles imbriquées. Le handler `uncaughtException` (l.6) consigne le message mais l'exécution **ne reprend pas** : les parties restantes ne tournent pas et le récapitulatif final (l.32-33) ne s'affiche pas. Pour un harnais de stress dont le but est justement de détecter les crashs, c'est acceptable (le message est capturé) mais le comptage `ok/gel` devient partiel. Grille pt 3 : le seul callback réellement différé, `m.later`, est bien protégé (l.15).

### C2 — `e.stack.split('\n')[1]` suppose `e.stack` présent (cosmétique)
`srv/stress2.js:6` et `:15` — Si l'objet jeté n'est pas une `Error` (ou a `stack` undefined), `e.stack.split` jette **dans le handler lui-même**. Dans un outil de diagnostic c'est sans conséquence réelle.
