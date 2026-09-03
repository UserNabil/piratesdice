# Rapport — srv/src/learn/weights.js (57 lignes)

Gère le jeu de poids ACTIF de l'évaluation IA : cache mémoire (lu très souvent par la recherche), chargement/initialisation depuis la base, rafraîchissement tolérant aux pannes, historique.

## a) Fonctions (nom | ligne)
- `current` | 15
- `ensure` (async) | 19
- `refresh` (async) | 45
- `history` (async) | 50

**Écart de comptage** : 4 fonctions recensées contre 7 annoncées. Écart dû aux arrows (`active.weights.map(Number)`, chaîne `Math.min/max`) et à la métrique. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| current | rend le cache mémoire | `cached` initialisé L13 avec des défauts valides → ne renvoie JAMAIS null (rassure l'accès `active.version` dans http.js) ; pur | OK |
| ensure | charge les poids actifs ou insère les poids d'origine | `active.weights.map(Number)` throw si `weights` null (ligne base attendue non-null) ; `sanitizeWeights` valide, sinon repli défaut ; SQL paramétré ; rejet propagé (index.js/refresh gèrent) | OK |
| refresh | ensure avec filet | try/catch → renvoie `cached` sur erreur, ne rejette jamais | OK |
| history | historique borné | `LIMIT $1` avec `Math.min(Math.max(parseInt(limit,10)||10,1),50)` — clamp 1..50 du paramètre client ; paramétré ; rejet propagé (http.js `.catch(()=>[])`) | OK |

## c) Findings
Aucune faille. Fichier bien défensif :
- `cached` toujours un objet valide (défaut L13) → aucun accès en aval ne peut lire `undefined.version`.
- `sanitizeWeights` filtre des poids corrompus en base et retombe sur les défauts, avec log.
- `history` **valide et borne** le `limit` fourni par le client (clamp 1..50) et paramètre la requête — ni injection, ni LIMIT extrême.
- `refresh` avale les erreurs et rend le cache — jamais de rejet.
- État de module `cached` : réaffecté en bloc (swap de référence atomique en mono-fil), pas de lecture déchirée entre appels concurrents.

Statut : OK
