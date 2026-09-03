# Audit — pd/www/js/core/api.js (38 lignes)

Fichier lu en entier. Lot annonce **4 fonctions**, **4 trouvées** (écart 0).

## (a) Fonctions

| nom | ligne |
|---|---|
| get | 15 |
| (arrow) `() => stop.abort()` | 22 |
| getOr | 30 |
| errMessage | 36 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| get | route `/api/dice/session`→sessionForDevice, `/api/dice/status`→probeServer, sinon fetch générique borné à 6 s | rejet propagé au caller (par conception) ; `r.json()` peut rejeter (rattrapé par getOr) ; `path` non validé (interne) ; les deux routes déléguées ne passent pas par le garde-délai local (elles ont le leur dans identity.js) | OK |
| arrow ligne 22 | avorte le fetch au bout de 6 s | callback différé protégé : `clearTimeout` en `finally` | OK |
| getOr | get avec repli silencieux `fallback` sur toute erreur | retour d'erreur volontairement avalé (par conception) | OK |
| errMessage | extrait un message lisible d'une erreur | `e` null géré via `String(e)` | OK |

## (c) Findings

- **api.js:16-17 | cosmétique** | `if (path === '/api/dice/session') return sessionForDevice();` / `...status') return probeServer();` | Ces deux routes ne bénéficient PAS du `AbortController` 6 s de `get` (il n'entoure que le fetch générique lignes 21-27). Ce n'est pas un défaut : elles délèguent à identity.js qui pose son propre `avecDelai`. À noter seulement.
- Ressources : `clearTimeout(t)` en `finally` (l.25) → pas de fuite de timer. OK.

**Verdict : OK**
