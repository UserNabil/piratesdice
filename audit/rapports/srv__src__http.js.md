# Rapport — srv/src/http.js (220 lignes)

Routeur HTTP REST (santé, device/google/apple auth, leaderboard, shop, ai, me, inventory, history, purchase). Lecture de corps bornée, CORS, résolution du joueur via jeton porteur. Client-facing.

## a) Fonctions (nom | ligne)
- `cors` | 16
- `json` | 23
- `readBody` | 30
- `bearer` | 48
- `identify` (async) | 53
- `publicPlayer` | 60
- `makeHandler` | 68
- `handle` (async, retournée par makeHandler) | 69

**Écart de comptage** : 8 fonctions recensées contre 35 annoncées. Surcompte massif de la métrique auto : callbacks d'événements (`req.on('data', c => …)`, `'end'`, `'error'`) et exécuteurs de Promise dans `readBody`, plus les nombreux `.catch(() => …)`. Fichier lu en entier.

## b) Grille par fonction
| nom | rôle | risques | statut |
|-----|------|---------|--------|
| cors | pose les en-têtes CORS (`*`) | permissif mais assumé pour une API de jeu ; pas de throw | OK |
| json | sérialise et répond | `JSON.stringify` peut throw sur cyclique (corps interne contrôlé) | OK |
| readBody | lit le corps borné à 64 Ko, parse JSON | listeners `data/end/error` ; oversize → reject + `req.destroy()` ; JSON malformé → reject ; voir finding #1 (jamais de settle si le client ne finit pas) | OK (faible) |
| bearer | extrait le jeton `Bearer` | `req.headers.authorization || ''` ; pur | OK |
| identify | vérifie le jeton + charge le joueur | `store.ensurePlayer` awaité, rejet propagé à handle (mitigé index.js) | OK |
| publicPlayer | projette la vue publique d'un joueur | pur | OK |
| makeHandler | fabrique le handler avec l'état | closure sur `state` | OK |
| handle | route la requête | nombreux `await store.*`/`q(...)` non try/caught localement, mais mitigés par le catch global d'index.js ; validation d'entrées déléguée au store (finding #2) | OK |

## c) Findings
Aucune faille bloquante. **Contexte déterminant** : `index.js` enveloppe ce handler dans `http.createServer((req,res) => handler(req,res).catch(e => { …500… }))`. Toute promesse rejetée par `handle`/`identify` (panne DB sur `store.leaderboard`, `store.catalog`, `store.inventory`, `store.deletePlayer`, `store.history`, `device.claim`, `apple.claim`, `store.purchase*`, `store.getPlayer`, etc. — aucun de ces `await` n'a de try/catch local) est donc rattrapée → 500 « server error » + `res.end`. Pas de hang, pas de crash. Observations :

1. **`readBody` ne se règle jamais si le client n'émet ni `end` ni `error` (L30-46)** — gravité : fuite ressource (faible). Une requête POST qui envoie un corps partiel puis se tait laisse `await readBody(req)` en attente indéfinie (le catch global ne se déclenche pas, la promesse ne rejette pas). Mitigé par `server.requestTimeout` (défaut ~5 min sur Node ≥ 18) qui détruit la socket et émet `error` → reject. Aucun timeout applicatif propre ici.

2. **Validation d'entrées déléguée au store (L124, L172, L201-202)** — gravité : état incohérent (faible, dépend du store). `url.searchParams.get('limit')` (leaderboard/history) et `body.quantity` (purchase) sont transmis au store sans borne ni typage ici. Le commentaire L187-189 affirme que rien du réseau n'approche une requête SQL (paramétrage côté store) — l'injection est donc écartée si le store paramètre bien, mais une `quantity` négative/non entière ou un `limit` extrême relèvent de la robustesse du store (hors de ce fichier). À confirmer côté `store.purchase*`/`leaderboard`.

3. **TOCTOU achat/partie (L184-202)** — gravité : état incohérent (très faible). Entre `state.gateway.enPartie(...)` et l'appel `store.purchase*`, une partie pourrait démarrer ; de même deux achats concurrents dépendent de l'atomicité du store pour ne pas double-dépenser. Délégué au store (UPDATE conditionnel attendu).

Statut : OK
