# Rapport d'audit — pd/www/js/pages/dice_hasard.js

Fichier lu en entier (50 lignes). Rôle : générateur pseudo-aléatoire reproductible
(Mulberry32) — copie du serveur `dice-server/src/game/tirage.js`. La vérification
des parties hors-ligne repose sur l'égalité bit-à-bit des deux tirages.

## a) Liste des fonctions

| nom | ligne |
|---|---|
| generateur | 37 |
| suivant (closure retournée) | 39 |

Comptage conforme au lot (2).

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| generateur | crée un PRNG déterministe depuis une graine | `(Number(graine)>>>0)||1` neutralise null/undefined/NaN/0 ; math entière pure, pas d'exception | OK |
| suivant | renvoie le prochain flottant [0,1) | `>>> 0` à chaque étape (préserve l'exactitude 32 bits) ; pas d'état partagé (closure privée `a`) ; pas d'effet de bord | OK |

## c) Findings détaillés

Aucune FAILLE.

Vérification de l'invariant critique (copie identique client/serveur) :
`generateur` est byte-for-byte identique à `dice-server/src/game/tirage.js:32-41`
(mêmes constantes 0x6D2B79F5 / 15 / 1 / 7 / 61 / 14 / 4294967296, mêmes `>>> 0`,
même `Math.imul`). L'invariant « même suite des deux côtés » est donc respecté au
moment de l'audit — pas de rejet de parties honnêtes de ce fait.

Le client omet volontairement `graineNeuve` (côté serveur seulement, dépend de
`crypto`) : correct, le client reçoit ses graines du serveur et n'en fabrique pas.

Grille : pas d'async, pas de callback différé, pas de ressource à libérer, pas
d'état partagé mutable entre appels, entrée bornée. Fonction pure.

Statut fichier : OK.
