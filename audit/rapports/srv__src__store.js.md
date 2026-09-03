# Rapport d'audit — `srv/src/store.js`

Chemin réel : `/Users/develop/dice-server/src/store.js` — 1012 lignes.
Lot annonce **79 fonctions**. Compte réel : **38 fonctions de premier niveau** (toutes `async`). L'écart (79 vs 38) vient des callbacks `=>` internes : les fonctions `fn` passées à `tx(async (c) => …)`, et les `.map/.reduce/.filter/.every` (ex. `settleMatch` en contient une dizaine). Écart noté, non bloquant.

Contexte technique (lu dans `src/db.js`) : `q`/`one` **propagent** le rejet ; `tx(fn)` fait `BEGIN`→`fn`→`COMMIT`, `ROLLBACK`+`throw` sur erreur, et `client.release()` en `finally` (donc **pas de fuite de connexion**). Toutes les fonctions de `store.js` s'appuient là-dessus.

## a) Liste des fonctions (nom | ligne)

| nom | ligne | | nom | ligne |
|-----|-------|-|-----|-------|
| joueurDeAlias | 20 | | reclamerSucces | 504 |
| lierIdentite | 39 | | lireCompteurs | 573 |
| reparerCapitaine | 95 | | poserCompteurs | 582 |
| ensurePlayer | 110 | | remettreJetons | 600 |
| creerJoueur | 130 | | consommerJeton | 636 |
| setSkin | 162 | | marquerRefus | 667 |
| setMotif | 181 | | horsLigneDuJour | 672 |
| setCaptain | 193 | | compteursDe | 680 |
| getPlayer | 198 | | historiqueDe | 712 |
| nomLibre | 208 | | replayDe | 738 |
| setDisplayName | 215 | | succesDe | 747 |
| campagneDefs | 222 | | settleMatch | 762 |
| campagneProgression | 229 | | deletePlayer | 984 |
| poserEtoiles | 241 | | history | 990 |
| crediterOr | 257 | | appliquerCompteurs | 427 |
| leaderboard | 268 | | ouvrirSucces | 458 |
| rankOf | 284 | | catalog | 296 |
| purchaseBasic | 325 | | inventory | 315 |
| purchasePremium | 367 | | consumeItem | 395 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| joueurDeAlias | Retrouve le joueur derrière un alias (device/apple/google) | requête paramétrée, rejet propagé | OK |
| lierIdentite | Rattache un sujet fournisseur au joueur de l'appareil, ou en crée un | écritures multiples hors transaction (voir F3) | OK |
| reparerCapitaine | Remet le capitaine par défaut si NULL/inconnu | catch avale l'erreur DB volontairement (confort), défaut posé en mémoire | OK |
| ensurePlayer | Trouve (par alias) ou crée le joueur | rejet propagé | OK |
| creerJoueur | INSERT joueur + alias (ON CONFLICT) | 2 écritures hors tx (INSERT player puis alias) : voir F3 | OK |
| setSkin | Pose une parure après vérif possession en base | `null` si non possédé, paramétré | OK |
| setMotif | Pose un motif après vérif possession | idem setSkin | OK |
| setCaptain | UPDATE captain | pas de vérif possession ici (faite par l'appelant, cf. commentaire l.157) | OK |
| getPlayer | SELECT joueur par id | rien | OK |
| nomLibre | Vérifie qu'un nom d'affichage est libre (casse-insensible) | TOCTOU assumé (pas d'index unique) → deux homonymes possibles | OK (cosmétique) |
| setDisplayName | UPDATE display_name | aucune borne de longueur ici (déléguée à l'appelant) | OK |
| campagneDefs | Liste les niveaux de campagne | rien | OK |
| campagneProgression | Map(level→étoiles) d'un joueur | rien | OK |
| poserEtoiles | OR binaire des étoiles + renvoie les « neuves » | `neuves` faussé si deux règlements concurrents du MÊME niveau (voir F2) | OK (risque noté) |
| crediterOr | +or si montant>0 | garde `!(montant>0)` couvre NaN/négatif | OK |
| leaderboard | Top N classement | limite bornée 1..1000 | OK |
| rankOf | Rang d'un joueur (row_number) | `.catch(()=>null)` : rejet avalé, appelant doit gérer null | OK |
| catalog | Catalogue boutique | rien | OK |
| inventory | Inventaire du joueur (avec catégorie) | rien | OK |
| purchaseBasic | Achat en pièces, débit atomique | débit `WHERE basic_coins>=cost RETURNING` atomique | OK |
| purchasePremium | Achat en monnaie maudite | idem, atomique | OK |
| consumeItem | Décrémente un item si quantité>0 | UPDATE conditionnel atomique | OK |
| appliquerCompteurs | Fusionne les compteurs (sum/max/now) par unnest | `Math.round(Number(v)||0)` neutralise NaN | OK |
| ouvrirSucces | Ouvre les succès atteints (INSERT…ON CONFLICT RETURNING) | atomique | OK |
| reclamerSucces | Réclame les succès ouverts, crédite bourses+objets | filtre regex hostile, UPDATE…RETURNING atomique | OK |
| lireCompteurs | Lit les compteurs DANS la tx courante | rien | OK |
| poserCompteurs | Applique compteurs + ouvre succès (tx) | rien | OK |
| remettreJetons | Complète le stock de jetons hors-ligne jusqu'au lot | **lecture-puis-insert non atomique → sur-émission concurrente** (F1) | FAILLE |
| consommerJeton | Consomme un jeton ET brûle ses prédécesseurs (1 ordre) | CTE atomique, très bien conçu | OK |
| marquerRefus | Note la raison d'un refus (slice 200) | rien | OK |
| horsLigneDuJour | Compte les parties hors-ligne créditées sur 24h | rien | OK |
| compteursDe | Compteurs d'un joueur (hors tx) | rien | OK |
| historiqueDe | Dernières parties multi (exclut solo) | limite bornée, appartenance filtrée | OK |
| replayDe | Journal d'une partie SI le joueur y était | appartenance vérifiée en SQL | OK |
| succesDe | Tableau des succès (catalogue + progression) | rien | OK |
| settleMatch | Règle une partie : Elo, prime, compteurs, succès, ligne `match` | **écriture Elo absolue depuis lecture hors-tx + aucune idempotence anti double-règlement** (F4) ; rejet parfois avalé par l'appelant (F5) | FAILLE |
| deletePlayer | Efface un joueur (cascade schéma) | `{ok:true}` même si 0 ligne (inoffensif) | OK |
| history | Historique brut (toutes parties) | limite bornée | OK |

## c) Findings détaillés

### F1 — `remettreJetons` : lecture du stock puis insertion, non atomique → sur-émission sous concurrence
`srv/src/store.js:600-624` — gravité **état incohérent** (parties hors-ligne gratuites en trop)

```js
const restants = (await q('SELECT count(*)::int AS n FROM offline_ticket
                           WHERE player_id = $1 AND used_at IS NULL', [playerId]))[0];
const manquants = Math.max(0, combien - (restants ? restants.n : 0));
...
if (neufs.length) { await q(`INSERT INTO offline_ticket ... unnest(...)`, ...); }
```

Le comptage (`restants`) et l'insertion (`manquants` jetons) sont **deux ordres séparés**, hors transaction. Deux appels concurrents pour le même joueur (double-tap sur le bouton, deux appareils, deux onglets WS) lisent tous deux `restants.n = k`, calculent tous deux `manquants = combien - k`, et **insèrent chacun** ce lot : le joueur se retrouve avec jusqu'à `2·combien − k` jetons non utilisés au lieu de `combien`. L'invariant « au plus `combien` jetons non utilisés » (que le commentaire pose explicitement, l.605-608) est cassé. Chaque jeton excédentaire = une partie hors-ligne gratuite de plus à créditer au retour. Grille pt 7. Correctif hors périmètre (à noter : un `INSERT … SELECT … WHERE (SELECT count …) < combien` ou un verrou par joueur rétablirait l'atomicité).

### F2 — `poserEtoiles` : `neuves` calculé depuis une lecture pré-UPDATE → double-paiement possible en concurrence
`srv/src/store.js:241-256` — gravité **état incohérent** (or de campagne payé deux fois), faible probabilité

```js
const avantRow = await one(`SELECT etoiles ... WHERE player_id=$1 AND level_id=$2`, ...);
const avant = avantRow ? avantRow.etoiles : 0;
const apres = avant | masque;
if (apres !== avant) { await q(`INSERT ... ON CONFLICT ... etoiles = campaign_progress.etoiles | $3`, ...); }
return { avant, apres, neuves: apres & ~avant };
```

L'`UPDATE` en base est correct (OR sur la valeur courante, donc aucun bit perdu). En revanche `neuves` est calculé à partir de `avant`, **lu avant** l'écriture. Deux règlements concurrents du même niveau (rare : un joueur ne finit pas deux fois le même palier simultanément) liraient tous deux `avant=0`, retourneraient tous deux `neuves = masque`, et l'appelant (`crediterOr` sur les étoiles neuves) paierait l'or **deux fois**. Probabilité faible (un seul joueur, une seule partie live), d'où statut OK/risque noté plutôt que FAILLE, mais l'invariant « une étoile ne paie qu'une fois » n'est garanti que hors concurrence. Grille pt 7.

### F3 — Suites d'écritures hors transaction dans `lierIdentite` / `creerJoueur` (note)
`srv/src/store.js:39-73` et `:130-156` — gravité **état incohérent** (mineur)

`creerJoueur` fait `INSERT player` (l.140) puis, **dans un ordre séparé**, `INSERT player_alias` (l.153). `lierIdentite` enchaîne `INSERT alias` puis `UPDATE player` (nom). Si le process meurt entre les deux, on peut avoir un `player` sans son alias primaire, ou un alias posé sans le nom mis à jour. Les `ON CONFLICT DO NOTHING` rendent l'ensemble rejouable (une reconnexion répare), donc l'impact réel est faible — signalé pour mémoire, pas classé FAILLE. Grille pt 7.

### F4 — `settleMatch` : note Elo écrite en ABSOLU depuis une lecture hors-tx, et aucune garde d'idempotence
`srv/src/store.js:762-982` — gravité **état incohérent** (double crédit / note perdue)

Deux points sur la même fonction :

1. **Lecture des notes hors transaction, écriture absolue dedans.** Les notes/parties sont lues l.797-799 (`SELECT id, rating, games …`, via `q`, **hors** du `tx` qui commence l.856), le nouveau rating est calculé (`after[i]`), puis écrit en base l.895-905 par `rating = $3` — une valeur **absolue** issue de la lecture antérieure. Les pièces (`basic_coins + $2`), parties (`games + $7`), victoires/défaites/nulles (`+`) sont relatives donc sûres ; **seul `rating` est absolu**. Si deux règlements touchant le même joueur s'exécutent en recouvrement, le second écrase la note du premier (last-writer-wins) → une variation d'Elo perdue.

2. **Aucune idempotence.** Rien n'empêche `settleMatch` d'être appelé **deux fois** pour la même partie (course entre une fin normale et un handler de déconnexion/reconnexion) : il n'existe pas de clé d'idempotence ni de contrainte d'unicité sur `INSERT INTO match (…)` (l.907-914). Un double-règlement crédite alors **deux fois** pièces/Elo/`games`, ouvre deux fois les compteurs, et insère **deux lignes** dans `match`. Combiné au point 1, la note serait de plus incohérente. Grille pt 7. (Le point 1 seul suppose deux parties concurrentes d'un même joueur — normalement impossible ; le vrai déclencheur est le double-appel du point 2.)

### F5 — `settleMatch` : rejet avalé par un appelant (multi) — la partie n'est pas persistée en silence
`srv/src/store.js:762` (retour d'erreur) + `srv/src/gateway.js:1630-1648` — gravité **état incohérent**

`settleMatch` rejette (correctement) sur toute erreur DB, mais le chemin multi de l'appelant l'entoure d'un `try/catch` qui se contente de logguer :

```js
try { ledger = await store.settleMatch({...}); }
catch (e) { console.error('[match] could not persist result:', e.message); }
```

Si la persistance échoue, l'exécution continue avec `ledger` inchangé : **aucun** rating, pièce, `games`, succès ni ligne `match` n'est écrit, et le joueur n'en est pas informé (seul un `console.error`). Le commentaire de `store.js:838-847` documente précisément la version historique de ce piège (le shadowing de `succes`, qui avalait 100 % des règlements). Le chemin solo/hors-ligne (`gateway.js:728`, dans `reglerHorsLigne`) est lui bien traité par le try/catch de l'appelant (`panne = e.message`, `credit -= 1`) — mais le jeton a déjà été consommé (`consommerJeton` l.662) avant le règlement, donc un échec = jeton brûlé sans crédit. Ces deux points relèvent de `gateway.js` (hors lot) ; côté `store.js`, `settleMatch` se comporte correctement (rejet propagé, tx atomique, `client.release` garanti). Grille pt 8, signalé au titre de la chaîne d'appel.

### Points vérifiés SANS faille (pour traçabilité)
- **Injection SQL** : toutes les requêtes sont paramétrées (`$1…`), y compris `identify`, `pseudo`, `nom`, `matchId`. `PLAYER_COLS` est une constante littérale, pas une entrée. Aucune concaténation d'entrée. RAS.
- **Client hostile** : `reclamerSucces` filtre les identifiants (`/^[A-Z0-9]{1,12}$/`), `quantity`/`limit`/`matchId` sont bornés/`parseInt`, `crediterOr` refuse ≤0/NaN. RAS.
- **Ressources** : `tx` libère toujours la connexion (`finally`), les autres fonctions passent par `pool.query`. Pas de fuite. RAS.
- **`await` manquant** : aucun — chaque appel DB est `await` ou `return`é (le `return q(...)` rend la promesse, l'appelant `await`). RAS.
