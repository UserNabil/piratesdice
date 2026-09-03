# Rapport d'audit — `srv/test/bonus_unique.test.js`

Chemin réel : `/Users/develop/dice-server/test/bonus_unique.test.js` — 181 lignes.
Lot annonce **18 fonctions**. Compte réel : **2 helpers** (`table`, `tableAvecPendule`) + **6 cas `test(...)`** = 8 ; le reste sont des arrows de hooks inline. Écart noté.

Nature : tests `node:test` sur `src/game/match` — un effet ne se joue qu'une fois par partie, et la pendule d'absence ne se relève qu'à l'application de l'effet.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| `table()` | 20 |
| test « le meme effet est refuse la seconde fois » (async) | 31 |
| test « un AUTRE effet reste jouable … » (async) | 42 |
| test « ce qui a ete joue voyage dans l'instantane » (async) | 53 |
| test « l'effet refuse ne consomme ni jeton ni droit » (async) | 65 |
| `tableAvecPendule()` | 101 |
| test « jouer un effet sans cible relance la pendule » (async) | 113 |
| test « viser NE relance PAS la pendule » (async) | 138 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `table` | `Match` multi 2 humains, `awayMs:0`, `begin()` | timers ~0 ms, pas de blocage possible | OK |
| `tableAvecPendule` | Idem mais `awayMs:30000` (pendule longue) | traité par try/finally dans les tests concernés | OK |
| tests l.31/42/53/65 | Async, `await activateBonus`, `clearTimers()` en fin | `awayMs:0` → un échec avant `clearTimers` ne laisse pas de timer long | OK |
| tests l.113/138 | Async, vieillissent `awayArmedAt` à la main, `try { … } finally { clearTimers() }` | dépendance à l'horloge réelle (`ecoule < 1000`) | OK |

## c) Findings détaillés

Aucune **FAILLE**. Points positifs relevés :
- Les deux tests à pendule longue (l.113, l.138) enveloppent le corps dans `try { … } finally { match.clearTimers(); }` — le commentaire l.115-119 documente exactement pourquoi : une assertion qui échoue avant `clearTimers()` laisserait courir une pendule de 30 s et **bloquerait toute la suite** `node --test`. La leçon est appliquée là où le timer est long (grille pt 3/6).
- Les quatre premiers tests n'utilisent que `clearTimers()` en dernière ligne, mais leur CONFIG met `awayMs:0` : aucun timer long à fuir, donc pas de blocage même sur échec. Acceptable.

**Réserve cosmétique** (grille pt 3) : les assertions `ecoule < 1000` (l.132, l.178) dépendent du temps mural réellement écoulé entre le ré-armement et la mesure. Sous une CI très chargée, ce delta pourrait dépasser 1000 ms et faire clignoter le test. Fenêtre minuscule (deux `await`), probabilité faible — signalé pour mémoire, pas une faille.
