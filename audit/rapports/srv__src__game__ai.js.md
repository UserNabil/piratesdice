# Rapport d'audit — srv/src/game/ai.js

Fichier : `/Users/develop/dice-server/src/game/ai.js` (666 lignes)
Métrique lot : 72 fonctions. **Compte réel : 13 fonctions nommées** + de nombreux arrow-callbacks (`meilleure`, `holding`, `note`, `ecart`, et les callbacks `filter`/`forEach`/`map`/`reduce` inline). L'écart avec 72 vient de ces arrows — aucune fonction cachée.

## a) Liste des fonctions (nom | ligne)

pickName 12 | openColumns 30 | greedyColumn 45 | chooseColumn 95 | totalDe 191 | bestGain 198 | juiciestCell 211 | colonnes 231 | menaceSur 298 | poses 318 | planEffet 342 | bonusPlan 616 | etoilesDuNiveau 659
Arrows notables : meilleure 52, holding 59 (dans greedyColumn) ; note 509, ecart 567 (dans planEffet).

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| pickName | nom d'IA aléatoire | index borné | OK |
| openColumns | colonnes jouables (hors gelée) | boucle bornée COLUMNS | OK |
| greedyColumn | cervelle gloutonne (facile + filet) | `allowed` non vide vérifié ; index rng borné | OK |
| chooseColumn | choisit la colonne (recherche + filets) | **`search.bestMove` en try/catch → repli glouton** ; gère column<0 et colonne gelée ; `interdite` via Number.isInteger ; weights via `sanitizeWeights` | OK (robuste) |
| totalDe | total brut d'une grille | boucle bornée | OK |
| bestGain | gain du dé dans la meilleure colonne | `place`/`columnScore` bornés ; die non-null aux appels | OK |
| juiciestCell | cellule adverse la plus chère | boucle bornée | OK |
| colonnes | colonne adverse chère / sienne pauvre | boucle bornée | OK |
| menaceSur | pire pose adverse possible | boucle bornée, pas d'info cachée (ne lit pas le dé adverse) | OK |
| poses | nb de dés posés | `reduce` | OK |
| planEffet | plan pour chacun des 16 effets | pur ; `die` null gardé (B001/B012) ; `st.quarters` via `typeof`/`Array.isArray` ; moveTop/swapQuarters bornés | OK |
| bonusPlan | l'effet à jouer avant de poser, ou null | garde budget ; `autorises.has` ; itère table constante | OK |
| etoilesDuNiveau | étoiles selon le niveau (pour snapshot) | lookup avec défaut `\|\| 3` | OK |

## c) Findings détaillés

Aucune FAILLE. Module central de l'IA, mais entièrement piloté par l'état serveur (grids/die/seat/options), jamais par une entrée client directe. Points d'attention traités correctement :

- **`chooseColumn` ne peut pas bloquer un tour d'IA** (`/Users/develop/dice-server/src/game/ai.js:118-148`). `search.bestMove` est entouré d'un `try/catch` qui retombe sur la cervelle gloutonne (`greedy-fallback`, l.128-132) ; un résultat `column < 0` ou tombant sur la colonne gelée (`interdite`) retombe aussi sur le glouton. Combiné au filet de `Match.aiPlace` (qui relit le refus de `place()`) et à `driveAi`/`etape` (try/catch + `aiStillPlaying`), l'IA a trois filets successifs : une exception de recherche ne laisse jamais la table morte — le défaut exact que les commentaires du fichier décrivent (« une partie solo sur quatre » figée).
- **Poids appris validés** : `evalMod.sanitizeWeights(options.weights) || DEFAULT_WEIGHTS` (l.121) — un jeu de poids corrompu venu de la DB d'entraînement ne peut pas injecter de NaN/valeur aberrante dans la recherche (voir rapport eval.js).
- **Pas d'information cachée** : `menaceSur` (l.298) évalue le pire coup possible sur les six faces sans lire le dé à venir de l'adversaire — conforme à la contrainte « l'IA ne doit pas accéder à ce qu'un humain ne peut pas connaître ».
- **Pureté / concurrence** : aucun `await`, aucun timer, aucun état mutable partagé (`AI_NAMES`, `LEVELS`, `ORDRE_PAYANT`, `ETOILES_NIVEAU` sont des constantes en lecture seule). `planEffet`/`bonusPlan` ne mutent pas `grids` (ils passent par `rules.place`/`moveTop`/`swapQuarters` qui rendent de nouvelles grilles). Deux appels concurrents ne partagent rien.
- `die` est gardé null là où il est indexé/évalué (B001 l.349, B003 l.373, B012 l.481) ; les champs de `st` (quarters, interdite, gele) sont lus défensivement.

## Verdict
OK (0 FAILLE). Module robuste ; ses filets de repli sont une défense directe contre les tours d'IA bloqués.
