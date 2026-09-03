# Rapport d'audit — `srv/test/contrat_horsligne.test.js`

Chemin réel : `/Users/develop/dice-server/test/contrat_horsligne.test.js` — 341 lignes.
Lot annonce **41 fonctions**. Compte réel : **4 helpers** (`moduleClient`, `partieDuClient`, `partieAvecEffet`, `accepte`) + **~10 cas `testSiClient`/`test`** + le wrapper `testSiClient` ; le reste sont des arrows inline (`.every`/`.map`/`.find`/`.some`, hooks stubs). Écart noté.

Nature : test de **contrat inter-dépôts**. Il importe dynamiquement le VRAI moteur du client (modules ES de `../../piratesdice/www/js/pages/`) et soumet son journal au VRAI vérificateur serveur (`src/game/horsligne`). Aucun des deux n'est simulé.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| `moduleClient(nom)` (import dynamique) | 26 |
| `testSiClient` (wrapper skip) | 47 |
| `partieDuClient(graine)` | 56 |
| test « une partie jouee par le client est acceptee » | 81 |
| test « dix graines differentes … » | 93 |
| test « les quarts du pont … » | 102 |
| test « un journal retouche est refuse » | 109 |
| test « toute partie arrive a son terme » | 136 |
| test « les effets a cible attendent leur case » | 162 |
| test « l etat pousse annonce l effet en visee » | 228 |
| test « un effet sans cible ne met pas en visee » | 260 |
| `partieAvecEffet(graine, jouer)` | 284 |
| `accepte(p, graine, quoi)` | 314 |
| test « B012 a B016 ne se jouent plus hors ligne » | 322 |

## b) Grille par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| `moduleClient` | `import(pathToFileURL(...))` d'un module client | rejet propagé (échec de test) si module absent/cassé | OK |
| `testSiClient` | Remplace `test` par un `test` qui `skip` si le dépôt client est absent | garde `fs.existsSync` en amont | OK |
| `partieDuClient` / `partieAvecEffet` | Jouent une partie entière avec le moteur client | **boucle plafonnée** (`garde++ < 200/400`) → jamais infinie | OK |
| `accepte` | Vérifie l'acceptation serveur + égalité des scores | assertions bornées | OK |
| (les tests) | Contrat client/serveur : même hasard, même score, effets à cible | async `await`és, hooks stubs sans timer | OK |

## c) Findings détaillés

Aucune **FAILLE**. Au contraire, ce fichier illustre plusieurs bonnes pratiques directement pertinentes pour la grille :

- **Garde anti-boucle-infinie** (grille pt 5) : `partieDuClient` (l.64) et `partieAvecEffet` (l.293) plafonnent la boucle de jeu (`garde++ < 200` / `< 400`) puis `break`. Une partie qui ne se terminerait pas ne bloque donc pas le test ; l'assertion `p.finie` la révèle (c'est exactement le défaut « une partie sur trois se figeait » que le test l.136 traque).
- **Dépendance externe annoncée, pas fatale** (grille pt 5) : le commentaire l.28-44 documente que ce test a **bloqué tous les déploiements six heures** parce qu'il ÉCHOUAIT quand le dépôt voisin `piratesdice` était absent en CI. Le correctif (`CLIENT_LA = fs.existsSync(...)`, l.46, et `testSiClient` qui `skip`) fait qu'un test injouable **le dit** au lieu d'échouer et de retenir la production. Bonne réponse à un vrai incident.
- **Import dynamique inter-dépôt** : `import()` est bien `await`é ; un module manquant fait échouer le test concerné, pas crasher le process.
- **Ressources** : les parties hors-ligne n'ont pas de pendule (aucun timer), les hooks sont des stubs vides, aucune base ni socket. Rien à libérer. RAS.
