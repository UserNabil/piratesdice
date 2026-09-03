# srv/src/auth.js

Ecart avec le lot : nb_fonctions=6. Recompte manuel : 4 fonctions nommees
(`b64urlDecode`, `b64urlEncode`, `sign`, `verifyToken`). Aucune fleche. La metrique
auto (6) est surevaluee — pas d'impact sur l'audit.

## a) Fonctions
| nom | ligne |
|-----|-------|
| b64urlDecode | 6 |
| b64urlEncode | 11 |
| sign | 15 |
| verifyToken | 21 |

## b) Par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| b64urlDecode(s) | decode base64url -> Buffer | appele avec des strings (token.slice) ; Buffer.from ignore les chars invalides, pas d'exception ; si `s` non-string -> `.length` leverait, mais aucun appelant ne le fait | OK |
| b64urlEncode(buf) | encode Buffer -> base64url | appele avec des Buffers ; pas d'exception sur usage nominal | OK |
| sign(payloadObj,secret) | HMAC-SHA256 d'un payload JSON | `createHmac('sha256','')` reste valide (cle vide autorisee) donc pas de crash meme si secret='' ; un secret vide produit un jeton non verifiable, mais verifyToken refuse un secret vide en amont | OK |
| verifyToken(token,secret) | verifie signature+exp+sub, ne LEVE jamais | tres defensif : refuse secret vide, token non-string ou >4096, absence de point ; `timingSafeEqual` protege par un test de longueur prealable (evite le throw sur longueurs differentes) ; JSON.parse dans try/catch ; verifie `exp` numerique et `sub` string non vide | OK |

## Analyse detaillee
- **Exceptions (pt 1)** : verifyToken renvoie des objets `{ok:false,error}` au lieu de
  lever — aucun chemin ne jette vers l'appelant. Le seul JSON.parse est encadre (l.35).
- **Entrees hostiles (pt 4)** : token controle par le client — longueur bornee (4096),
  format valide, comparaison HMAC en temps constant. Solide.
- **Rejets/async (pt 2)** : rien d'async ici.

## c) Findings
Aucune faille.

## Statut : OK
