# Rapport — srv/src/google.js (176 lignes)

Chemin d'authentification Google Play : échange serveur-à-serveur du « server auth code » contre un accès, puis résolution d'identité (Play Games `pg-` ou OpenID `g-`), et émission d'un jeton de jeu signé. Client-facing (via le routeur HTTP).

## a) Fonctions (nom | ligne)
- `configured` | 34
- `fetchJson` (async) | 38
- `exchange` (async) | 48
- `sujetOpenId` | 78
- `whoIs` (async) | 102
- `claim` (async) | 120

**Écart de comptage** : 6 fonctions recensées contre 10 annoncées. Pas de fonction cachée (aucune arrow inline notable) ; l'écart vient de la métrique auto. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| configured | Google est-il configuré ? | pur, pas de throw | OK |
| fetchJson | POST/GET + parse JSON tolérant | timeout via `AbortSignal.timeout` seulement s'il existe (voir finding #2) ; rejet de `fetch` propagé aux appelants ; JSON.parse en try/catch → body null | OK (faible) |
| exchange | échange le code chez Google | throw Error si refus ; rejet réseau propagé, attrapé par claim | OK |
| sujetOpenId | lit le sub/nom du id_token SANS vérif de signature | correct ici (jeton reçu de Google par TLS, pas du client) ; vérifie `aud`; try/catch → null ; `String(idToken||'')` gère null | OK |
| whoIs | résout l'identité (Play Games puis OpenID) | throw si aucune identité, attrapé par claim ; rejet fetch attrapé par claim | OK |
| claim | orchestre et rend `{ok,status,body}` | voir finding #1 : `store.lierIdentite` + `sign` HORS du try/catch (mitigé par le catch global d'index.js) | OK (faible) |

## c) Findings

1. **`claim` — la persistance et la signature sont hors du try/catch (L144, L159)** — gravité : connexion dégradée (500 générique au lieu d'un message propre). **Mitigé** : `claim` n'est appelée que depuis `http.js` `/api/google`, dont le handler est enveloppé dans `index.js` par `handler(req,res).catch(...)` → réponse 500 « server error » + `res.end`, plus `process.on('unhandledRejection')`. Donc **pas de hang ni de crash** ; l'impact réel est seulement qu'un code Google valide couplé à une panne DB transitoire renvoie un 500 générique au lieu du `{ok,status,body}` propre que le contrat de `claim` promet.
   ```js
   let who;
   try { who = await whoIs(await exchange(code)); }
   catch (e) { return { ok:false, status:401, body:{ error:e.message } }; }
   ...
   const { player, fusion } = await store.lierIdentite(sub, local, who.name || undefined); // hors try
   ...
   token: sign(payload, config.secret),  // hors try
   ```
   Le try/catch ne couvre QUE `exchange`/`whoIs`. Si `store.lierIdentite` rejette (erreur DB transitoire, contrainte, indisponibilité) ou si `device.validDevice`/`subjectOf`/`sign` lèvent, la promesse de `claim` rejette et l'erreur **s'échappe** de ce fichier. Vérifié côté appelant : `index.js` enveloppe le handler (`handler(req,res).catch(...)` → 500 + `res.end`), donc pas de hang ni de crash — seulement une réponse 500 générique. Le commentaire promet « une panne côté Google n'est jamais une erreur du joueur » mais ne couvre pas la panne côté store ; le contrat de `claim` (toujours rendre `{ok,status,body}`) est rompu sur le chemin DB, sans conséquence bloquante grâce au filet d'index.js.

2. **`fetchJson` — le timeout disparaît silencieusement sans `AbortSignal.timeout` (L39)** — gravité : fuite ressource / requête suspendue. `const stop = AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined;` : sur un runtime sans `AbortSignal.timeout`, `signal` vaut `undefined` et le `fetch` peut pendre indéfiniment (le « rideau ne se lève pas »). Non atteignable sur Node ≥ 17.3, mais le repli masque la perte de garde-fou plutôt que d'échouer franchement.

Statut : OK
(Le finding #1 est réel — contrat de `claim` rompu sur le chemin DB — mais entièrement rattrapé par le catch global d'index.js : 500 générique, ni hang ni crash. Gravité résiduelle cosmétique/dégradée.)
