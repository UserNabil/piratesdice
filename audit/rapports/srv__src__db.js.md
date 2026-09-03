# srv/src/db.js

Fichier de focalisation du lot (injection SQL, gestion pool/connexions, rejets).
Ecart avec le lot : nb_fonctions=4. Recompte manuel : 3 fonctions nommees
(`q`, `one`, `tx`) + 1 callback fleche `pool.on('error', ...)` = 4. Conforme.

## a) Fonctions
| nom | ligne |
|-----|-------|
| pool.on('error') callback | 8 |
| q | 12 |
| one | 17 |
| tx | 22 |

## b) Par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| pool.on('error') | logge les erreurs des clients IDLE du pool | aucun — c'est justement la garde qui empeche un crash process sur erreur de client inactif (ex. redemarrage Postgres) | OK |
| q(text,params) | execute une requete et rend `res.rows` | rejet propage a l'appelant (par design d'un helper) ; injection possible SEULEMENT si un appelant construit `text` par concatenation — ici `params` est transmis tel quel a `pool.query`, la requete est parametree | OK |
| one(text,params) | comme q mais rend la 1re ligne ou null | idem q ; `rows.length ? rows[0] : null` gere le cas vide | OK |
| tx(fn) | transaction : BEGIN, fn(client), COMMIT, ROLLBACK sur erreur | connexion TOUJOURS liberee (finally) ; ROLLBACK protege par try/catch interne ; `pool.connect()` est HORS du try donc rien a liberer s'il echoue | OK |

## Analyse detaillee (grille 8 points)
- **Injection (pt 4)** : `q`/`one` passent `params` a `pool.query(text, params)` — requetes
  PARAMETREES. Le wrapper lui-meme n'introduit aucune injection ; le risque residuel
  vit chez les appelants qui interpoleraient des valeurs dans `text` (aucun ici).
- **Rejets (pt 2)** : les trois helpers PROPAGENT le rejet (pas de `.catch` interne),
  ce qui est le comportement attendu d'un helper. La garde de dernier recours pour les
  clients inactifs est `pool.on('error')` (l.8). Les rejets des requetes de requete-appel
  sont la responsabilite des appelants.
- **Pool / connexions (pt 6)** : `tx` libere le client dans `finally` (l.33) dans tous
  les chemins ou `connect()` a reussi. Pas de fuite de connexion. `config.db` fixe
  `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` (voir config.js).
- **Concurrence (pt 7)** : le pool gere la concurrence ; `tx` prend un client dedie par
  appel, pas d'etat partage mutable dans ce module.

## Observation mineure (pas une faille)
`srv/src/db.js:30-33` — gravite : fuite ressource (tres faible). Sur le chemin d'erreur,
`client.release()` est appele SANS argument. La bonne pratique serait `client.release(e)`
(ou `release(true)`) pour DETRUIRE une connexion possiblement corrompue plutot que la
rendre au pool. En pratique node-postgres retire de lui-meme les clients dont le socket
a reellement casse (ils emettent 'error'), et apres un ROLLBACK reussi la connexion est
saine : risque residuel negligeable. Note d'amelioration, non bloquant.

## c) Findings
Aucune faille.

## Statut : OK
