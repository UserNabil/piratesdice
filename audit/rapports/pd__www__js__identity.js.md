# Audit — pd/www/js/identity.js (417 lignes)

Fichier lu en entier. Lot annonce **41 fonctions**, **28 trouvées**. Écart -13 : lu intégralement, aucune fonction manquée — l'écart vient du compteur du lot (heuristique qui surcompte, ici probablement `await`/appels de méthode).

## (a) Fonctions

| nom | ligne | | nom | ligne |
|---|---|---|---|---|
| garderSession | 36 | | jwtApple | 287 |
| sessionGardee | 48 | | jetonApple | 295 |
| serverBase | 62 | | claimApple | 307 |
| wsFrom | 67 | | codeGoogle | 320 |
| avecDelai | 90 | | claimGoogle | 332 |
| (arrow) `() => stop.abort()` | 92 | | claimDevice | 340 |
| (arrow) `fini: () => clearTimeout(t)` | 93 | | signOut | 348 |
| post | 96 | | account | 363 |
| deviceId | 118 | | isSignedIn | 370 |
| (arrow) `(b) => b.toString(16)...` | 123 | | eraseAccount | 377 |
| guestName | 129 | | sessionForDevice | 398 |
| fournisseur | 163 | | probeServer | 407 |
| plugin | 169 | | | |
| pret | 177 | | | |
| googleAvailable | 201 | | | |
| signIn | 208 | | | |

## (b) Par fonction (risques notables)

| nom | rôle | risques | statut |
|---|---|---|---|
| garderSession | mémorise la session + persiste | **`setItem(KEY_MODE)` l.38 hors du try/catch** (seul KEY_SESSION l.40 protégé) | FAILLE (mineur) |
| sessionGardee | relit la session non périmée | entièrement try/catch → null en cas d'erreur | OK |
| serverBase / wsFrom | base HTTP/WS | `PD_CONFIG` optionnel | OK |
| avecDelai | AbortController + timeout | fournit `.fini()` pour clearTimeout | OK |
| post | POST JSON borné, throw si !ok | timeout via avecDelai + `finally fini()` ; JSON.parse en try | OK |
| deviceId | secret 256 bits, tiré une fois | **localStorage get/set non protégés** (l.119,124) | FAILLE (mineur) |
| guestName | nom d'équipage aléatoire | **localStorage non protégé** (l.130,133), appelé aussi par `account()` hors try | FAILLE (mineur) |
| pret | `initialize` natif, mémoïsé | **mémoïse une promesse même REJETÉE** (l.191) — voir finding #1 | FAILLE |
| signIn | ouvre une session (reprise/Google/Apple/invité) | gros try/catch ; interactif rethrow, silencieux → null | OK |
| jwtApple | choisit le JWT par sa FORME (3 parties) | valide `typeof===string` + `split('.').length===3` (entrée hostile OK) | OK |
| jetonApple/claimApple/claimGoogle/claimDevice | échanges serveur | dépendent de `post` (throw géré en amont) ; `body.token` non revérifié | OK |
| signOut | déconnexion native + purge locale | `logout` en try/catch ; **`setItem(KEY_MODE,'guest')` l.357 non protégé** | mineur |
| account | fiche pour les réglages | appelle `guestName()` → peut lever si stockage HS | mineur (voir #3) |
| eraseAccount | efface compte serveur puis local | **`avecDelai().signal` sans `.fini()`** (l.381) | mineur (voir #4) |
| sessionForDevice | session pour dice_net (reprise si expirée) | throw `no session` si échec ; caller (api.get) gère | OK |
| probeServer | état service pour écran de panne | tout en try/catch, **ne lève jamais** ; `.fini()` non appelé (l.411) | OK (fuite mineure) |

## (c) Findings

1. **identity.js:191 (pret) | état incohérent (fonctionnalité bloquée)** | `prepare = p.initialize(...)` mémoïse la PROMESSE, rejet compris | Un échec transitoire d'`initialize` (natif) fige `prepare` sur une promesse rejetée pour toute la session : chaque `pret()` suivant renvoie cette même promesse rejetée → `login`/connexion Google & Apple ne peuvent PLUS jamais aboutir jusqu'au redémarrage de l'app. Le mode invité continue, mais la liaison au compte est cassée pour la session. Le commentaire vise « initialize une seule fois » (OK sur succès) mais ne rejoue pas sur échec. Gravité : état incohérent.
2. **identity.js:38 (garderSession) | état incohérent (mineur)** | `localStorage.setItem(KEY_MODE, mode);` HORS du try/catch qui protège le `setItem(KEY_SESSION)` (l.39-42) | Si le stockage lève (plein/désactivé), `garderSession` lève avant d'écrire la session — incohérent avec l'intention affichée (« pas de quoi bloquer »). Rattrapé par les try/catch de `signIn`, donc dégradé (null/rethrow) sans crash.
3. **identity.js:130,133 + 366 (guestName/account) | état incohérent (mineur)** | `localStorage.getItem/setItem` non gardés dans `guestName`/`deviceId` | Dans les chemins `claim*` c'est sous le try/catch de `signIn` (rattrapé). MAIS `account()` (l.366) appelle `guestName()` HORS try : un stockage indisponible ferait lever le rendu des réglages. Non bloquant pour la partie.
4. **identity.js:381 (eraseAccount) et 411 (probeServer) | fuite ressource (cosmétique)** | `avecDelai(...).signal` utilisé sans jamais appeler `.fini()` | Le timer d'abort n'est pas annulé : il se déclenche après coup (abort sur requête déjà réglée = no-op) mais retient un timer 3–6 s. Cosmétique.

## Secrets / sécurité

- `CLIENT_WEB` (l.146) et `CLIENT_IOS` (l.151) sont des **OAuth client IDs, PUBLICS par construction** (documenté en commentaire) — PAS des secrets. Aucun secret serveur dans l'app.
- Le secret invité 256 bits (`deviceId`) est généré via `crypto.getRandomValues` et gardé localement, envoyé au serveur comme identifiant d'appareil (par conception). Pas de fuite.

**Verdict : FAILLES(4) [état incohérent]**
