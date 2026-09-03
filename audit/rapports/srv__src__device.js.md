# Rapport d'audit — srv/src/device.js

Fichier : `/Users/develop/dice-server/src/device.js` (128 lignes)
Métrique lot : 8 fonctions. **Compte réel : 5 fonctions nommées** (l'écart vient d'arrow-callbacks internes aux `.replace()` et de la façon dont la métrique approxime — pas de fonction cachée).

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| rateOk | 42 |
| subjectOf | 55 |
| cleanName | 61 |
| validDevice | 71 |
| claim (async) | 82 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| rateOk | limite le débit par IP via Map en mémoire | IP fournie par le caller = header `X-Forwarded-For` (client) → contournement du rate-limit ; `hits.clear()` à 5000 remet TOUS les compteurs à zéro | FAILLE (faible) |
| subjectOf | dérive un sujet stable (HMAC) depuis le deviceId | `crypto.createHmac` jette si `config.secret` absent ; exporté donc appelable hors garde de `claim` | OK (garde amont dans claim) |
| cleanName | nettoie/tronque le nom de capitaine | gère `null`, retire caractères de contrôle, borne à 16 | OK |
| validDevice | valide le format du deviceId | gère `null`, borne 32..128, regex url-safe | OK |
| claim | échange un secret d'appareil contre un jeton | `await store.ensurePlayer` sans try/catch ET caller http.js sans filet → requête login qui pend | FAILLE (login bloqué) |

## c) Findings détaillés

### F1 — `claim` : rejet de `store.ensurePlayer` non géré, caller sans filet (gravité : partie/login bloquée)
`/Users/develop/dice-server/src/device.js:96`
```js
const player = await store.ensurePlayer(sub, wanted || undefined);
```
Le contrat documenté est « rend `{ ok, status, body }` — le routeur HTTP n'a plus qu'à répondre ». Mais si la base est momentanément indisponible, `ensurePlayer` **rejette** et `claim` rejette avec elle. Le caller `src/http.js:94` (`const out = await device.claim(ip, body);`) n'est PAS entouré d'un try/catch, et la fonction `handle` de http.js n'a aucun catch global : la promesse de `handle` rejette, aucune réponse n'est écrite, et la requête de connexion **pend jusqu'au timeout socket**. Un simple hoquet DB au moment du login laisse le joueur bloqué sans message. `sign()` étant synchrone après l'`await`, une exception là (secret mal formé) prend le même chemin. Le contrat « toujours résoudre en {ok,status,body} » est violé. (Note : le même schéma vaut pour google.claim/apple.claim, hors lot.)

### F2 — `rateOk` : clé de limitation contrôlable par le client + purge globale (gravité : abus / ressource, faible)
`/Users/develop/dice-server/src/device.js:42-52`
```js
if (hits.size > 5000) hits.clear();   // garde-fou memoire
```
`ip` provient dans http.js de `req.headers['x-forwarded-for']` (voir `src/http.js:92`), une valeur **fournie par le client**. En faisant varier ce header à chaque requête, un attaquant obtient à chaque fois une entrée neuve (`count: 1`) et n'atteint jamais `RATE_MAX` : le rate-limit sur `/api/device` (création de comptes invités + écritures DB `ensurePlayer`) est trivialement contournable. Accessoirement, `hits.clear()` déclenché à 5000 entrées (facile à provoquer avec des IP forgées) remet à zéro les compteurs de tous les vrais clients. La décision de keying est côté http.js, mais elle rend `rateOk` inopérant tel qu'appelé.

## Verdict
2 FAILLES (gravité max : partie/login bloquée).
