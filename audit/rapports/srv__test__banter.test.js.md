# Rapport d'audit — `srv/test/banter.test.js`

Chemin réel : `/Users/develop/dice-server/test/banter.test.js` — 91 lignes.
Lot annonce **17 fonctions**. Compte réel : **2 helpers** (`horlogeReglable`, `dePipe`) + **8 cas `test(...)`** = 10 ; le reste (arrows `f`, `f.avance`, `() => tirage`, prédicats) sont inline. Écart noté.

Nature : tests `node:test` sur `src/game/banter`. La cadence est simulée par une **horloge réglable** (`horlogeReglable`) et le hasard par un **tirage prévisible** (`dePipe`) — aucun timer réel, aucune base, aucun aléatoire, aucun async.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| `horlogeReglable()` | 10 |
| `dePipe(valeurs)` | 18 |
| test « une humeur hors du catalogue est refusee » | 23 |
| test « on ne peut pas marteler son portrait » | 32 |
| test « le silence d un joueur … » | 41 |
| test « une partie a un plafond d humeurs » | 47 |
| test « une pique porte une replique … » | 57 |
| test « les piques se taisent entre elles » | 66 |
| test « une situation inconnue … » | 76 |
| test « l IA ne renvoie jamais l humeur … » | 81 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `horlogeReglable` | Horloge manuelle (`f()` lit `t`, `f.avance(ms)` l'avance) | aucun | OK |
| `dePipe` | Tirage déterministe cyclique `valeurs[i++ % len]` | cycle borné, jamais d'index hors bornes | OK |
| (les 8 `test`) | Vérifient bornes d'humeur, cadence, plafond par partie, non-écho IA | synchrones, entrées hostiles testées (`'2'`, `1.5`, `-1`, `MOODS`) | OK |

## c) Findings détaillés

Aucune **FAILLE**. Le module testé valide bien les entrées hors-bornes (le test l.23-30 le prouve : `-1`, `MOODS`, `1.5`, `'2'` → `null`). Tests synchrones, sans ressource ni aléatoire (grille pts 2,3,6 sans objet). RAS.
