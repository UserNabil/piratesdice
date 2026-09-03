# Audit — srv/test/silence.test.js

Fichier : `/Users/develop/dice-server/test/silence.test.js` — 99 lignes.
Nature : test unitaire (`node:test`) de `Gateway.balayerLesMuets` et `Gateway.onClose` — une session muette trop longtemps est terminée puis sa table mise de côté, et une socket morte ne met pas en pause une place déjà reprise.

`nb_fonctions` annoncé : 18. Compté : 18 (5 helpers/méthodes + 4 callbacks `test` + 9 arrows de stub inline). **Concordant.**

## a) Liste des fonctions

| nom | ligne |
|---|---|
| `socket()` (helper) | 15 |
| méthode arrow `send: (t) => recus.push(JSON.parse(t))` | 19 |
| méthode `terminate()` | 20 |
| `passerelle()` (helper) | 24 |
| `session(g, vu, silence)` (helper) | 36 |
| cb test « une session muette trop longtemps est terminee » | 43 |
| cb test « la session qui parle encore garde sa place » | 52 |
| cb test « sans cadence annoncee, le delai reste large » | 59 |
| cb test « terminer une session muette met sa table de cote » | 68 |
| stub arrow `seat: () => place` | 75 |
| stub arrow `g.dequeue = () => {}` | 76 |
| stub arrow `g.closeRoomOf = () => {}` | 77 |
| stub arrow `g.park = (sess, match) => {...}` | 78 |
| cb test « une socket morte ne met pas en pause la place qu'un autre a reprise » | 84 |
| stub arrow `seat: () => place` | 92 |
| stub arrow `g.dequeue = () => {}` | 94 |
| stub arrow `g.closeRoomOf = () => {}` | 95 |
| stub arrow `g.park = () => { parked = true; }` | 96 |

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| `socket` | faux `ws` (readyState OPEN, `send` qui parse le JSON reçu, `terminate` qui marque `termine`) | `send` fait `JSON.parse(t)` : un `t` non-JSON jetterait — mais `send` n'est jamais appelé dans ces tests. Test-only | OK |
| arrow `send` l.19 | enregistre le message envoyé après parse JSON | non exercé ici ; aucun | OK |
| `terminate` l.20 | marque la socket terminée, passe readyState à 3 | aucun | OK |
| `passerelle` l.24 | `Gateway` via `Object.create` + toutes les Maps/Sets attendus par `balayerLesMuets`/`onClose` | contourne le constructeur ; peuple explicitement `sessions/queue/parked/matches/rooms/engagement/finEnAttente`. Fragile si le code sous test lit un autre champ, mais complet pour l'objet visé | OK |
| `session` l.36 | crée une session (ws, player, match, seatIndex, vu, silence) et l'enregistre | aucun | OK |
| cb l.43 | muet 40 s > silence 20 s → terminé ; récent 3 s → laissé | aucun ; couvre le seuil de silence | OK |
| cb l.52 | `vu=now` → jamais terminé | aucun | OK |
| cb l.59 | silence large 60 s, vu il y a 25 s → non coupé (versions sans cadence annoncée) | aucun ; couvre le défaut « pas de cadence » (point 4) | OK |
| cb l.68 | muet → `onClose` met la table de côté via `park` (stubs sur dequeue/closeRoomOf) | aucun ; vérifie que `park` reçoit bien la session | OK |
| stubs l.75-78 | remplacent seat/dequeue/closeRoomOf/park pour isoler `onClose` | aucun | OK |
| cb l.84 | place reprise par une nouvelle session (`place.session===nouvelle`) → l'ancienne `onClose` ne doit PAS `park` | aucun ; couvre l'invariant « la place n'appartient qu'à la session qui la tient » | OK |
| stubs l.92-96 | isolent `onClose` pour le second scénario | aucun | OK |

Passage de la grille (8 points) : tests synchrones, sans Promise ni `await` ni callback différé (points 1/2/3 sans objet). Point 4 (entrées limites : silence court/long, cadence absente, place reprise) explicitement couvert. Points 5/6/7/8 (blocage joueur, libération ressource, concurrence, retour ignoré) sans objet pour un test unitaire synchrone. Les stubs neutralisent correctement les effets de bord de `onClose`.

## c) Findings détaillés

Aucune faille. Les deux scénarios reproduisent des incidents vécus (session fantôme muette, place reprise remise en pause) et vérifient le bon comportement de `balayerLesMuets`/`onClose`.

Note (non-faille) : `socket().send` ferait `JSON.parse` sur du non-JSON ; inoffensif ici car jamais invoqué dans ces cas. Même dépendance implicite au constructeur contourné que dans les autres tests (helper `passerelle`), sans gravité.

**Statut fichier : OK**
