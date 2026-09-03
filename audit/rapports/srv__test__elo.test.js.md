# Audit — srv/test/elo.test.js (118 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **14 fonctions**,
**~11 trouvées** (écart 3 — la métrique auto compte chaque `=>` ; ici 1 helper
`avec` + 10 rappels de `test(...)`. Écart signalé, non bloquant).

## (a) Fonctions

| nom | ligne |
|---|---|
| `avec` (helper arrow) | 17 |
| test « battre un compte qui vient de naitre… » | 19 |
| test « deux joueurs classes et proches… » | 28 |
| test « un ecart de niveau trop grand… » | 35 |
| test « une table quittee avant d'avoir joue… » | 43 |
| test « la meme paire ne se classe que trois fois… » | 50 |
| test « LA FRAUDE COMPLETE… » | 60 |
| test « et meme en jouant vraiment… » | 77 |
| test « une partie contre la machine paie sa duree » | 103 |
| test « seule la MONTEE au classement paie… » | 108 |
| test « une table ouverte puis refermee ne paie rien » | 115 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `avec` | fabrique une variante de la REGLE de référence | aucun (pur) | OK |
| tests l.19-58 | vérifient les 4 conditions de `rules.notesEnJeu` (compte neuf `new`, écart `gap`, partie courte `short`, plafond de paires `pair`) sur le VRAI module `../src/game/rules` | assertions présentes et ciblées (`bouge` + `raison`) ; code réel testé, pas un mock | OK |
| test l.60 « fraude complète » | 40 abandons en boucle ne rapportent aucun point ; boucle déterministe, assertion finale `gagne === 0` | assertion forte et exacte ; couvre le scénario de triche décrit dans l'en-tête | OK |
| test l.77 « en jouant vraiment » | scénario le plus favorable au tricheur ; assertion `gagne <= 32` | **assertion volontairement lâche** (`<=32` au lieu d'une valeur exacte) : un régression qui laisserait fuir jusqu'à 32 points passerait vert. Acceptable (borne = un seul gain) mais moins stricte que l.60. | OK (note) |
| tests l.103-118 `rules.prime` | IA paie 20, montée paie 100, table non jouée paie 0 | assertions exactes sur le vrai module | OK |

## (c) Findings

- Aucun test faussement vert. Tous appellent le **vrai** module `src/game/rules`
  (`notesEnJeu`, `newRating`, `prime`), avec des assertions présentes et
  déterministes. Pas de timing, pas de `setTimeout`, pas d'async.
- **elo.test.js:96 | cosmétique** | `assert.ok(gagne <= 32, ...)` : borne large.
  Le test l.60 (`=== 0`) est bien plus contraignant ; celui-ci laisserait passer
  toute régression qui fait fuir 1 à 32 points. À resserrer si la règle promet 0.
- Couverture non testée : la branche `raison` non couverte serait toute condition
  autre que new/gap/short/pair, mais l'en-tête annonce exactement ces 4 — OK.

**Verdict : OK**
