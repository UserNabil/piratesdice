# Rapport d'audit — `srv/src/migrate.js`

Chemin réel : `/Users/develop/dice-server/src/migrate.js` — 29 lignes.
Lot annonce **4 fonctions**. Compte réel : **1 fonction déclarée** (`main`) + 3 arrow callbacks inline (`.catch(() => {})` l.20, et les analyses du lot comptent probablement `require`/arrow). Écart noté : le `nb_fonctions=4` est gonflé par les `=>` ; il n'y a qu'une vraie fonction, `main`.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| `main` | 7 |
| (arrow) `f => f.endsWith('.sql')` | 9 |
| (arrow) `() => {}` (catch ROLLBACK) | 20 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `main` | Lit tous les `sql/*.sql`, les trie, applique chacun dans sa propre transaction BEGIN/COMMIT | Erreurs hors `try` non captées + `main()` appelé sans `.catch` ; aucun registre des migrations appliquées (replay total à chaque run) ; commits par fichier → état partiel possible | FAILLE |

## c) Findings détaillés

### F1 — `readdirSync` / `pool.connect` hors du `try`, et `main()` sans `.catch` → rejet non géré, pool non fermé
`srv/src/migrate.js:8-10` et `:29` — gravité **crash process / fuite ressource**

```js
const dir = path.join(__dirname, '..', 'sql');
const files = fs.readdirSync(dir).filter(...).sort();   // l.9  — HORS try
const client = await pool.connect();                    // l.10 — HORS try
try { ... } catch (e) { ... process.exitCode = 1; }
finally { client.release(); await pool.end(); }
...
main();                                                  // l.29 — pas de .catch()
```

Le `try` ne commence qu'à la ligne 11. Si le dossier `sql/` est absent (`readdirSync` jette `ENOENT`) ou si la base est injoignable (`pool.connect()` rejette), l'erreur n'est pas attrapée par le `catch`. Comme `main()` est invoqué sans `.catch()` ni `await`, on obtient une **unhandled promise rejection** : le process meurt sans le message propre `[migrate] FAILED: …`, sans passer par le `finally` (donc **`pool.end()` n'est jamais appelé** → connexion/pool laissés ouverts), et sans passer par `process.exitCode = 1` (grille pts 1, 6, 8). Grille pt 5 : un opérateur ne voit pas la cause réelle, le déploiement échoue de façon opaque.

### F2 — Aucun registre des migrations appliquées : replay total à chaque exécution, idempotence déléguée entièrement au SQL
`srv/src/migrate.js:12-18` — gravité **état incohérent (conditionnel)**

```js
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), 'utf8');
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
}
```

Il n'existe **pas de table `schema_migrations`** ni de trace de ce qui a déjà été appliqué : **tous** les fichiers sont ré-exécutés à chaque `node migrate.js`. La non-régression repose donc à 100 % sur le fait que **chaque** fichier SQL soit rejouable. Vérification faite sur `sql/` (31 fichiers, `001_`…`031_`) : les auteurs ont bien fait l'effort — 22 `ON CONFLICT` pour 18 `INSERT`, `ADD COLUMN IF NOT EXISTS` (027), et l'`ADD COLUMN` de `020_reclamer.sql:44` est protégé par un garde `IF NOT EXISTS (SELECT … information_schema.columns …)`. **Aujourd'hui c'est donc rejouable.** Mais le code JS n'offre **aucun filet** : le jour où un `.sql` non-idempotent est ajouté (un `CREATE TABLE` sans `IF NOT EXISTS`, un `INSERT` sans `ON CONFLICT`, un `ALTER … ADD COLUMN` nu), le **deuxième** run casse ou duplique des données, sans garde-fou. Grille pt 7.

### F3 — Commits par fichier : échec au milieu du lot ⇒ schéma partiellement migré
`srv/src/migrate.js:14-16` — gravité **état incohérent**

Chaque fichier a son propre `BEGIN`/`COMMIT`. Si le fichier N échoue, les fichiers 1..N-1 sont **déjà committés** ; seul le N (en cours) est rollbacké (l.20). La base reste dans un état intermédiaire (schéma à moitié migré). La reprise n'est possible que parce que le SQL est rejouable (cf. F2) — mais rien ne le garantit dans le temps. Grille pts 5/7.

### Note (pas une faille aujourd'hui) — ordre lexicographique fragile
`srv/src/migrate.js:9` — `.sort()` trie les noms **en lexicographique**. C'est correct tant que les préfixes sont à largeur fixe zéro-paddés (`001_`…`031_`, ce qui est le cas). Latence : un futur `100_x.sql` ou un nom non paddé (`2_x.sql`) se classerait au mauvais endroit (`100_` < `031_`, `10_` < `2_`) → migrations dans le désordre → échec (ALTER avant CREATE). À surveiller, mais **pas** une faille en l'état actuel du dossier `sql/`.
