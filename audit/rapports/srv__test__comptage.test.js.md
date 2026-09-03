# Rapport d'audit — `srv/test/comptage.test.js`

Chemin réel : `/Users/develop/dice-server/test/comptage.test.js` — 138 lignes.
Lot annonce **11 fonctions**. Compte réel : **2 helpers** (`tableFinie`, `compter`) + **8 cas `test(...)`** = 10 ; le reste (arrow `g`, `Object.assign`) inline. Écart noté.

Nature : tests `node:test` sur `src/game/succes` (`compteurs`) et `src/game/rules` (`notesEnJeu`) — modules **purs**. Verrouille les conditions où un compteur monte (en ligne, contre un humain, partie menée à terme et assez longue), avec les exceptions « battez la machine ».

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| `tableFinie()` | 33 |
| `compter(contexte)` | 46 |
| test « une partie en ligne, menee au bout … » | 55 |
| test « contre la MACHINE, seuls les compteurs qui la nomment … » | 63 |
| test « battez la machine reste possible » | 75 |
| test « une table QUITTEE ne nourrit rien … » | 83 |
| test « une partie trop courte ne nourrit rien » | 90 |
| test « gagner des points au classement n est PAS exige » | 98 |
| test « celui qui RESTE garde sa partie … » | 115 |
| test « une table quittee AVANT d avoir joue … » | 131 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `tableFinie` | Fabrique un état de fin de partie plausible | données figées, aucune E/S | OK |
| `compter` | Appelle `succes.compteurs(...)` avec un contexte par défaut fusionné | `Object.assign` sûr, entrées locales | OK |
| (les 8 `test`) | Vérifient quels compteurs montent selon ia/classe/fini/assezJouee/raison | synchrones, sans ressource | OK |

## c) Findings détaillés

Aucune **FAILLE**. Tests purs, synchrones, sans base/réseau/timer (grille pts 2,3,6 sans objet). Aucune ressource à libérer, aucun rejet à gérer. RAS.
