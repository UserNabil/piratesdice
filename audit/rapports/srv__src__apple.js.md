# srv/src/apple.js

Ecart avec le lot : nb_fonctions=10. Recompte manuel : 4 fonctions nommees
(`base64url`, `clesApple`, `verifier`, `claim`) + 1 fleche `.find((k)=>...)`. La
metrique auto (10) est surevaluee. Toutes couvertes.

## a) Fonctions
| nom | ligne |
|-----|-------|
| base64url | 42 |
| clesApple | 46 |
| verifier | 67 |
| claim | 108 |

## b) Par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| base64url(part) | decode base64url -> Buffer | `String(part)` coerce, pas d'exception | OK |
| clesApple() | recupere/caches les cles publiques Apple | `fetch` avec `AbortSignal.timeout(8000)` (timeout present) ; rejet (reseau/timeout/JSON) propage et attrape par le try/catch de `claim` -> 401 ; cache mis a jour seulement en cas de succes ; concurrence -> double fetch idempotent | OK |
| verifier(identityToken) | verifie signature RS256 + iss + aud + exp + sub | verification COMPLETE et dans le bon ordre (signature AVANT de faire confiance au payload) ; header/payload JSON en try/catch ; toutes les erreurs remontent vers le try/catch de `claim` -> 401 | OK |
| claim(identityToken,nomPropose,deviceId) | orchestration -> {ok,status,body} | **FAILLE** : `verifier` est protege (try/catch -> 401) MAIS `await store.lierIdentite(...)` (l.128) et `sign(...)` (l.143) ne le sont pas | FAILLE |

## Analyse detaillee (grille)
- **Signature/entrees hostiles (pt 4)** : le jeton arrive par le client ; `claim` borne
  la longueur (20..8192), `verifier` verifie la signature contre les cles Apple, l'emetteur,
  le destinataire (`aud`) et l'echeance (`exp`). Robuste.
- **Rejets non geres (pt 2, 5, 8)** : voir finding ci-dessous — asymetrie de traitement.
- **Ressource (pt 6)** : `fetch` a un timeout (AbortSignal.timeout) — pas de connexion pendante cote sortant.

## c) Findings

### F1 — rejet non gere dans `claim` : requete HTTP pendante sur erreur DB
`srv/src/apple.js:128` (et `:143`) — gravite : partie/requete BLOQUEE (au pire, reponse jamais envoyee).

```
let sujet;
try { sujet = await verifier(brut); }
catch (e) { return { ok: false, status: 401, body: { error: e.message } }; }
...
const { player, fusion } = await store.lierIdentite(sub, local, nom);   // l.128 — HORS try/catch
...
token: sign(payload, config.secret),                                     // l.143 — idem
```

`verifier` est encadre (echec -> 401 propre), mais `store.lierIdentite` (acces DB) ne
l'est PAS. Sur un incident base (pool sature, connexion perdue, contrainte), la promesse
de `claim` REJETTE. Le caller `http.js:115` fait `const out = await apple.claim(...)`
SANS try/catch (seul `readBody` y est protege), et le handler `handle` n'a AUCUN
try/catch englobant. Le seul filet est `index.js:52` `process.on('unhandledRejection', ...)`
qui se contente de LOGGER : le processus ne tombe pas, mais la reponse `/api/apple`
n'est JAMAIS ecrite -> la requete de connexion Apple du joueur RESTE PENDANTE jusqu'au
timeout socket. Un simple hoquet DB transforme donc une erreur recuperable (qui devrait
etre un 500 propre) en connexion suspendue.

Note : le meme motif existe aussi hors de ce lot (google.js:144, et plusieurs `await
store.*` non gardes dans http.js) ; ici on ne signale que apple.js. Correctif naturel
(NON applique) : encadrer `lierIdentite`/`sign` dans le try (ou un try/catch englobant
cote http.js) pour renvoyer un 500/503 explicite.

## Statut : FAILLE(1) [partie bloquee]
