# Audit — pd/app/js/identity.js (417 lignes)

Fichier lu EN ENTIER (2 tranches). Lot annonce **41 fonctions** ; **~25 nommées** trouvées (+ arrows/callbacks). Écart -16 dû au compteur auto (chaque `=>` compté). Aucune fonction manquée.

## (a) Fonctions

| nom | ligne |
|---|---|
| garderSession(s, mode) | 36 |
| sessionGardee() | 48 |
| serverBase() (export) | 62 |
| wsFrom(base) | 67 |
| avecDelai(ms) | 90 |
| post(path, body) async | 96 |
| deviceId() | 118 |
| guestName() | 129 |
| fournisseur() (export) | 163 |
| plugin() | 169 |
| pret() | 177 |
| googleAvailable() (export) | 201 |
| signIn(opts) (export async) | 208 |
| jwtApple(out) | 287 |
| jetonApple(p) async | 295 |
| claimApple(jeton) async | 307 |
| codeGoogle(games, interactive) async | 320 |
| claimGoogle(code) async | 332 |
| claimDevice() async | 340 |
| signOut() (export async) | 348 |
| account() (export) | 363 |
| isSignedIn() (export) | 370 |
| eraseAccount() (export async) | 377 |
| sessionForDevice() (export async) | 398 |
| probeServer() (export async) | 407 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| garderSession | mémorise la session (mémoire + localStorage) | `setItem(KEY_MODE)` l.38 HORS du try/catch → peut jeter — voir finding | FAILLE |
| sessionGardee | relit la session non périmée | tout dans try/catch, gardes `!token/!expires`, marge 60 s | OK |
| serverBase | base serveur depuis `PD_CONFIG` | `replace` sur `''` par défaut → sûr | OK |
| wsFrom | http(s)→ws(s) | pur, replis | OK |
| avecDelai | AbortController + timeout | rend `{signal, fini}` ; `fini()` doit être appelé — pas toujours fait, voir finding | FAILLE |
| post | POST JSON avec timeout | `garde.fini()` en `finally` ; `r.text()` hors try mais après succès ; parse dans try/catch ; jette si `!r.ok` | OK |
| deviceId | id appareil (256 bits) persistant | `crypto.getRandomValues` OK ; `setItem` non gardé → peut jeter (rare) | OK (mineur) |
| guestName | pseudo invité aléatoire | `setItem` non gardé | OK (mineur) |
| fournisseur | apple sur iOS, google sinon | garde `Capacitor` | OK |
| plugin | accès natif SocialLogin | gardes optionnelles | OK |
| pret | mémoïse `initialize()` | mémoïse une promesse REJETÉE en cas d'échec → sign-in coincé pour la session, voir finding | FAILLE |
| googleAvailable | plugin présent ? | — | OK |
| signIn | orchestre reprise/google/apple/invité | try/catch ; silencieux ne bloque pas l'ouverture ; interactif remonte l'erreur ; repli invité protégé (l.255-261) | OK |
| jwtApple | trouve le JWT par sa FORME (3 parts) | robuste au renommage des champs du greffon | OK |
| jetonApple | login apple → {idToken, name} | `!jwt`→null ; profil optionnel | OK |
| claimApple | POST /api/apple | via `post` (timeout + throw) ; erreur remonte à signIn qui gère | OK |
| codeGoogle | code d'autorisation google | `!interactive`→null (pas de mur) | OK |
| claimGoogle | POST /api/google | via `post` | OK |
| claimDevice | POST /api/device | via `post` ; construit body avec deviceId/guestName (setItem peut jeter avant) | OK |
| signOut | déconnexion native + purge locale | `logout` dans try/catch ; `setItem/removeItem` non gardés | OK (mineur) |
| account | état affiché aux réglages | pas de réseau ; gardes | OK |
| isSignedIn | booléen | — | OK |
| eraseAccount | efface compte serveur puis local | `fetch` dans try/catch (hors ligne OK) ; MAIS `avecDelai().signal` sans `fini()` → timer non annulé, voir finding | FAILLE |
| sessionForDevice | garantit une session fraîche | jette `no session` si échec — l'appelant (dice_net) doit gérer (documenté) | OK |
| probeServer | sonde /health, ne jette jamais | try/catch→{ok:false} ; MAIS `avecDelai(3000).signal` sans `fini()` → timer non annulé | OK (mineur) |

## (c) Findings

- **identity.js:177-198 | état incohérent (mineur) — `pret()` mémoïse une promesse rejetée.**
  ```js
  if (!prepare) { prepare = p.initialize(...); }
  return prepare;
  ```
  Si `initialize()` échoue une fois (glitch natif transitoire), `prepare` conserve DÉFINITIVEMENT une promesse rejetée. Chaque `signIn` interactif suivant fait `await pret()` → re-rejet immédiat, sans jamais retenter `initialize`. La connexion Google/Apple reste donc cassée jusqu'au redémarrage de l'app. Le jeu reste jouable (repli invité), mais le bouton « se connecter » échoue en boucle pour toute la session. Correctif type : ne mémoïser qu'en cas de succès (remettre `prepare=null` sur rejet).

- **identity.js:381 et 411 | fuite ressource (mineure) — timeout jamais annulé.**
  `eraseAccount` (l.381 `signal: avecDelai().signal`) et `probeServer` (l.411 `avecDelai(3000).signal`) utilisent le signal mais JETTENT l'objet retourné : `fini()` n'est jamais appelé, donc `setTimeout(() => stop.abort(), …)` survit jusqu'à l'échéance même si le `fetch` a répondu. L'`abort()` tardif tombe sur une requête déjà réglée (inoffensif), mais un timer traîne 3-6 s. Contraste avec `post()` (l.107) qui, lui, appelle `garde.fini()`. Non bloquant.

- **identity.js:38 | cosmétique / état incohérent (rare) — `setItem` hors garde.**
  Dans `garderSession`, `localStorage.setItem(KEY_MODE, mode)` (l.38) est HORS du try/catch qui protège l'écriture de `KEY_SESSION` (l.40). En navigation privée / quota plein, il jette ; le compte vient pourtant d'être créé côté serveur → l'appelant interactif voit une erreur malgré le succès (état incohérent), le silencieux retombe en invité sans session gardée. Idem `deviceId`/`guestName`/`signOut` écrivent sans garde. Occurrence rare.

**Verdict : FAILLES(3) [gravité max : état incohérent]** — toutes mineures ; le jeu n'est jamais bloqué, mais la connexion peut se coincer pour une session (`pret`).
