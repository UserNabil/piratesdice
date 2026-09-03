# Rapport d'audit — `srv/test/antibot.test.js`

Chemin réel : `/Users/develop/dice-server/test/antibot.test.js` — 150 lignes.
Lot annonce **18 fonctions**. Compte réel : **1 helper** (`frappes`) + **10 cas `test(...)`** = 11 fonctions ; le reste (≈7) sont des arrows `.map`/`.every` inline. Écart attendu, noté.

Nature : suite de tests **`node:test`** sur `src/antibot`, module **pur** (aucune base, réseau, timer ni aléatoire). La variation des horodatages est déterministe (`Math.sin`), volontairement (commentaire l.27-28) pour éviter les tests clignotants.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| `frappes(nombre, delai, variation, depart)` | 23 |
| test « un joueur ordinaire ne declenche rien » | 36 |
| test « un joueur RAPIDE mais irregulier » | 44 |
| test « un joueur ASSIDU seul ne suffit pas » | 55 |
| test « cadence METRONOMIQUE » | 64 |
| test « un automate coche tous les signaux » | 72 |
| test « echantillon trop court » | 89 |
| test « longues pauses ne comptent pas » | 99 |
| test « plus longue plage » | 108 |
| test « le score s explique » | 123 |
| test « rien n est mesure sur l appareil » | 134 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `frappes` | Génère une suite d'horodatages espacés de `delai` ± variation déterministe | `Math.max(1, …)` évite un pas ≤0 ; aucune E/S | OK |
| (les 10 `test`) | Vérifient le score de suspicion et les signaux d'`antibot.noter/intervalles/plusLonguePlage/expliquer` | synchrones, assertions bornées, aucune ressource | OK |

## c) Findings détaillés

Aucune **FAILLE**. Tests synchrones, déterministes, sans base/réseau/timer/aléatoire (grille pts 2, 3, 6 sans objet). Le plus gros échantillon (`frappes(100000, …)`, l.81) alloue un tableau de 100k entiers — coût mémoire négligeable et volontaire (simule 8 h à 300 ms). Le module testé étant pur, une exception y remonterait comme échec de test, pas comme crash process. RAS.
