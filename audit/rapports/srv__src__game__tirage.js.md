# Rapport — srv/src/game/tirage.js (48 lignes)

Générateur pseudo-aléatoire reproductible (Mulberry32) partagé serveur/client, plus tirage de graine. But : rejouer côté serveur les dés lancés hors ligne par le téléphone pour détecter la triche.

## a) Fonctions (nom | ligne)
- `generateur` | 32
- `suivant` (fermeture retournée) | 34
- `graineNeuve` | 44

Lot annonce 3 fonctions — concordance exacte.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| generateur | construit un PRNG déterministe à partir d'une graine entière | `(Number(graine) >>> 0) || 1` neutralise null/undefined/NaN/0 (repli sur 1) ; arithmétique 32 bits pure, jamais de throw | OK |
| suivant | renvoie le tirage suivant dans [0,1) | pure, pas d'entrée, pas de throw | OK |
| graineNeuve | tire une graine 32 bits via crypto | `crypto` est injecté ; si le module fourni est absent ou que `randomBytes` échoue (entropie), throw synchrone remonté à l'appelant. Appelée côté serveur uniquement, pas d'exposition client directe | OK |

## c) Findings
Aucun. Fichier purement calculatoire, mono-fil, sans async/timer/ressource. La validation d'entrée de `generateur` est explicitement robuste. `graineNeuve` dépend d'un `crypto` injecté correct — hypothèse serveur légitime, pas une faille.

Statut : OK
