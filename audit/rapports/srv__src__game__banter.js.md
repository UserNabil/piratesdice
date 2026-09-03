# Rapport d'audit — srv/src/game/banter.js

Fichier : `/Users/develop/dice-server/src/game/banter.js` (118 lignes)
Métrique lot : 5 fonctions. **Compte réel : 4 méthodes nommées + 1 arrow** (`() => Date.now()` ligne 65) = 5. Concorde.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| Banter.constructor | 55 |
| Banter.mood | 73 |
| Banter.taunt | 87 |
| Banter.reponseIa (static) | 100 |
| arrow horloge par défaut | 65 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| constructor | initialise l'état de bavardage d'une partie | si `now` passé est truthy non-fonction, `this.horloge()` jettera à l'appel — mais toujours appelé sans arg (`new Banter()`) | OK |
| mood | valide/étrangle une humeur envoyée par un joueur | `index` (client) est validé ; `seat` n'est PAS validé mais provient du siège serveur (inMatch), donc ∈{0,1} | OK |
| taunt | tire une pique déclenchée par un événement de partie | `key` validé via `TAUNTS[key]`, garde `% lignes` protège d'un rng>=1 | OK |
| reponseIa (static) | choisit l'humeur de réponse d'une IA | `REPONSES[mood] || [0,1]` + garde `% length` — robuste à mood/rng hors bornes | OK |

## c) Findings détaillés

Aucune FAILLE.

Notes de vigilance (pas de faille exploitable en l'état) :

- **`mood` ne valide pas `seat`** (`/Users/develop/dice-server/src/game/banter.js:73-81`). Si `seat` n'était pas ∈{0,1}, `this.compteHumeur[seat]` vaudrait `undefined` → `undefined >= MOOD_PAR_PARTIE` faux, `t - undefined = NaN < MOOD_SILENCE_MS` faux, et `compteHumeur[seat] = NaN` : le plafond et le silence seraient définitivement désactivés (flood possible). Mais l'appelant est `match.mood(seatIndex, index)` où `seatIndex` est assigné côté serveur via `inMatch` (`src/gateway.js:414`), jamais lu du message client. `index = msg.mood` est, lui, validé (`Number.isInteger`, 0..4). Donc pas exploitable ; à garder à l'œil si un jour `seat` devenait client-contrôlé.

- **Aucun callback différé** (setTimeout/later) dans ce fichier : la cadence est mesurée par comparaison d'horloge, pas par timer. Rien à protéger de ce côté.

- **`taunt`/`reponseIa`** tirent deux fois `rng()` sans vérifier son domaine, mais le modulo final borne toujours l'index → pas de dépassement de tableau.

## Verdict
OK (0 FAILLE).
