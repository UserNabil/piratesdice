# Rapport d'audit — `srv/test/campagne.test.js`

Chemin réel : `/Users/develop/dice-server/test/campagne.test.js` — 81 lignes.
Lot annonce **11 fonctions**. Compte réel : **0 helper nommé** (une boucle de setup au niveau module, l.9-16) + **5 cas `test(...)`** ; le reste (arrows `.find`/`.filter`/le générateur `g`) sont inline. Écart noté.

Nature : tests `node:test` sur `src/game/campagne`, module **pur** (étoiles, or, ouverture de niveaux/paliers, sbire déterministe). Le dernier test lit deux fichiers du dépôt (SQL + source) pour vérifier une cohérence.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| (setup module, boucle `defs`) | 7-16 |
| test « les etoiles se calculent depuis le releve … » | 18 |
| test « l or ne paie que les etoiles neuves » | 28 |
| test « un niveau s ouvre derriere une victoire … » | 36 |
| test « le sbire d un niveau ne change pas de tete » | 58 |
| test « les contraintes du catalogue SQL … » | 68 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| test l.18/28/36/58 | Vérifient étoiles, or, ouverture, sbire déterministe | synchrones, sans ressource | OK |
| test l.68 | Croise `sql/029_campagne.sql` et `src/game/succes.js` : toute contrainte du catalogue doit exister dans `succes` | `fs.readFileSync` : un chemin absent jetterait → échec de test (voulu) | OK |

## c) Findings détaillés

Aucune **FAILLE**. Tests purs et synchrones (grille pts 2,3,6 sans objet). Le test l.68 fait deux `fs.readFileSync` : pas de handle laissé ouvert (lecture synchrone complète), et une erreur d'E/S se traduirait en échec de test, pas en crash process. La regex `/'((?:sum|max|now)\.[a-z._]+)'/g` est bornée et sans catastrophic backtracking. RAS.
