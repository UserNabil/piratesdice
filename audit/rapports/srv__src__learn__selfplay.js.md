# Rapport — srv/src/learn/selfplay.js (88 lignes)

Match de qualification : deux jeux de poids s'affrontent sur N parties (dés d'une graine fixe, couleurs alternées) pour décider si des poids appris remplacent les poids actifs. Calcul pur, synchrone.

## a) Fonctions (nom | ligne)
- `mulberry32` | 12
- `next` (fermeture retournée) | 14
- `playGame` | 24
- `duel` | 66

**Écart de comptage** : 4-5 fonctions recensées contre 6 annoncées. Léger surcompte de la métrique. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| mulberry32 | PRNG déterministe pour reproductibilité du duel | `seed >>> 0` gère NaN/undefined (→0) ; pur | OK |
| next | tirage suivant | pur | OK |
| playGame | joue une partie complète entre deux poids | boucle bornée `move < CELLS*2+6` + break sur isFull/colonne<0 → termine toujours ; `search.bestMove` sur grilles bien formées (emptyGrid/place) ; poids NaN → joue colonne 0, pas de crash | OK |
| duel | N parties, renvoie le taux de points du challenger | voir finding #1 (synchrone, bloquant) ; `points/games` = NaN si `games===0` (contrôlé par trainer) | OK (faible) |

## c) Findings
Aucune faille de correction. Une observation de robustesse opérationnelle :

1. **`duel`/`playGame` sont synchrones et bloquent l'event loop (L66-86, L39-52)** — gravité : partie/gateway ralentie (dépend de l'appelant). Une boucle `for (games)` × parties complètes × recherche expectimax, sans aucun `await` ni `yield`, monopolise le fil principal pendant toute sa durée. Sur un serveur qui sert aussi les WebSockets temps réel, lancer un duel de qualification long sur le fil principal gèlerait le jeu des joueurs le temps du calcul. La maîtrise du coût (nombre de parties, `timeMs`, exécution dans un worker/hors pic) relève de `trainer.js` — à vérifier là. Pas un défaut de ce fichier isolément.

Statut : OK
