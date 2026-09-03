# Audit — srv/test/quitter.test.js (145 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **29 fonctions**,
**~14 trouvées** (écart ~15 : la métrique auto compte chaque méthode du faux `match`
et chaque stub `=>`. Ici : `socket`, `table`, ~11 méthodes du mock match + 4 rappels
`test`. Écart signalé, dû aux nombreux `=>` du mock ; non bloquant).

## (a) Fonctions

| nom | ligne |
|---|---|
| `socket` | 16 |
| `table` | 21 |
| `match.seat` (mock) | 48 |
| `match.snapshot` (mock) | 49 |
| `match.replay` (mock) | 50 |
| `match.serialize` (mock) | 51 |
| `match.destroy` (mock) | 52 |
| `match.forfeit` (mock) | 53 |
| test « quitter previent les DEUX sieges » | 63 |
| test « la session de chacun est liberee » | 88 |
| test « un verdict qui ne part pas est garde… » | 114 |
| test « un verdict trop vieux ne surgit pas… » | 135 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `socket` | faux WS qui retient les `send` (JSON parsé) | aucun | OK |
| `table` | monte `Gateway.prototype` par `Object.create`, câble sessions/matches, **mock `match`** | teste les VRAIES méthodes `onLeave`, `settle`, `livrerFinEnAttente` ; le match est simulé (légitime : on teste l'annonce, pas les règles) | OK |
| test l.63 | `onLeave` déclare forfait le partant (`finiPar===0`) puis `settle` envoie exactement UNE annonce `over` à CHAQUE siège + `outcome==='win'` pour le restant | `async` correctement `await g.settle(...)` ; assertions fortes (comptage exact + contenu) | OK |
| test l.88 | après settle, chaque session est détachée (`match===null`, `seatIndex===-1`) et la table détruite | assertions exactes ; couvre le bug « l'autre reste sur une table morte » | OK |
| test l.114 | socket morte au moment du verdict → rien envoyé, verdict gardé (`finEnAttente.has(2)`), puis rejoué à la reconnexion et pas deux fois | `async`/`await` corrects ; trois assertions enchaînées, dont la non-répétition | OK |
| test l.135 | verdict vieux de 40 min ne surgit pas sur une session sans rapport | `livrerFinEnAttente` réel retourne `false`, `recus` vide | OK |

## (c) Findings

- Aucun test faussement vert : les 4 tests appellent le **vrai** gateway
  (`onLeave`/`settle`/`livrerFinEnAttente`). Les async sont correctement `await`és
  (node:test échouerait sur une promesse rejetée non gérée). Assertions présentes,
  exactes, ciblées.
- **quitter.test.js (frontière de couverture) | pas un bug, à documenter** :
  `settle` (gateway.js:1520) enferme volontairement tout son bloc « supplément »
  (compteurs, hauts faits, journal, `store.compteursDe`, rediffusion) dans un
  `try/catch` qui **avale les erreurs** pour ne jamais coûter l'écran de fin au
  joueur. Ces tests stubbent en plus `sendWallet`/`maybeTrain` et fournissent un
  `match` sans `bilan`/`journal`. Conséquence : ils prouvent SEULEMENT la couche
  annonce + libération de session ; une régression dans la prime/l'Elo/les hauts
  faits **ne serait pas vue ici** (elle est soit stubbée, soit avalée par le
  `catch`). C'est le rôle d'autres fichiers (elo, reglement…), mais la limite mérite
  d'être connue : « verdict envoyé » n'implique pas « bourse/classement corrects ».
- Pas de `setTimeout`/timer réel ; `Date.now() - 40*60*1000` (l.138) est un offset
  relatif → non flaky.

**Verdict : OK (frontière de couverture notée : settle avale son bloc supplément)**
