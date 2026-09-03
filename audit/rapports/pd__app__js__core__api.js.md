# Rapport — pd/app/js/core/api.js

Version mobile de l'acces reseau : sert `/api/dice/session` et `/api/dice/status` localement (via identity.js), et proxie les autres appels GET vers le serveur de jeu.

**Comptage** : lot = 4. Je compte 3 fonctions nommees (`get`, `getOr`, `errMessage`) + 1 flechee inline (`() => stop.abort()` ligne 22) = 4. Concorde.

## a) Liste des fonctions
- get | 15
- getOr | 30
- errMessage | 36
- (flechee) `() => stop.abort()` | 22

## b) Analyse par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| get | GET une route (session/status locales, sinon fetch serveur) | **AbortController + timeout 6 s** contre le hang serveur ; `clearTimeout` dans `finally` (timer libere quel que soit le chemin) ; `throw` sur `!r.ok` propage au caller — a la charge de l'appelant (voir note) | OK |
| getOr | get() avec valeur de repli sur erreur | try/catch, retombe sur `fallback` — defensif | OK |
| errMessage | extrait un message d'erreur lisible | null-safe (`e && e.message ... : String(e)`) | OK |

## c) Findings
Aucune faille.

Notes (non bloquantes) :
- `get` est exporte via `api.get` et jette (`throw new Error('HTTP '+r.status)`, rejet fetch/abort). Les appelants directs de `api.get` doivent gerer le rejet ; `getOr` le fait deja. Point 8 de la grille : depend des appelants (hors de ce fichier).
- Sur `path === '/api/dice/session'`/`'/api/dice/status'`, on renvoie directement les promesses de `sessionForDevice()`/`probeServer()` (identity.js) — leur rejet eventuel remonte ; hors perimetre de ce fichier.
- `path` provient d'appels internes a constantes connues, pas d'un client hostile.

## Statut : OK
