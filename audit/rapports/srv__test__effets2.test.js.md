# Audit — srv/test/effets2.test.js (703 lignes)

Fichier de test lu EN ENTIER par tranches (1-200, 200-400, 400-600, 600-703).
Framework `node:test`. Lot annonce **51 fonctions**, **~51 comptées** (helpers
`table`/`started`/`dernierEtat`/`plateaux` + hooks broadcast/consume/finish +
**39 rappels `test`** + arrows inline `.find`/`.map`/`.filter`. Métrique cohérente).

## (a) Fonctions (helpers + 39 tests)

| nom | ligne |
|---|---|
| `table` (+ hooks broadcast/consume/finish) | 37 |
| `started` | 56 |
| `dernierEtat` | 67 |
| B012 : 6 tests (faces, transforme, score, détruit, double commande, reconnexion) | 73-158 |
| B013 : 6 tests (brume, marque points, sans corr., multiple, reconnexion, fin de partie) | 162-260 |
| B014 : 5 tests (déplace 2 temps, ne détruit rien, refus, invalide, renoncer) | 264-334 |
| B015 : 7 tests (protège, expire, `suivreCase`, suit tassement, canon, propre dé, invalide, reconnexion) | 338-472 |
| B016 : 5 tests (échange 2 quarts, score bouge, refus, invalide, dure jusqu'à la fin) | 476-554 |
| transverses : catalogue+seuil, pas deux fois | 558-590 |
| `plateaux` | 603 |
| IA/B012-B016 : 6 tests (utile vs inutile) + IA ne voit pas le dé adverse | 607-702 |

## (b) Ce que ça couvre / fiabilité

| bloc | rôle | risques | statut |
|---|---|---|---|
| `table`/`started` | VRAI `Match` multi + hooks capturant states/fx/finished/consumed ; `started` fixe `quarters=[1,1,1,1]` (**4 valeurs, correct pour 4 colonnes**) | conception saine ; dés forcés (`match.dice[0]=X`) après `roll` → déterministe malgré RNG | OK |
| B012-B016 (moteur) | 8 preuves par effet : activation valide/invalide, avant/après, conso, expiration, reconnexion, double commande, fin de partie | assertions **exactes et riches** (grids, `pending` champ par champ, `bonusJoues`, `protege`/`protegeTours`, `quarters`, snapshots des DEUX sièges) ; tous les `await`és | OK |
| l.134 double commande | deux `pickFace` **lancés sans await intermédiaire** puis awaités : la 2e doit ne rien trouver | vrai test de concurrence/course ; assertion sur le message + `bonusJoues` compté une fois | OK |
| l.378 `suivreCase` | brique de tassement isolée (VRAI `rules.suivreCase`) | 6 cas exacts, y compris « emporté lui-même » (-1) | OK |
| l.558/572 transverses | catalogue cohérent, seuil capitaine == seuil boutique, aucun effet jouable deux fois | boucle sur les 5, assertions exactes | OK |
| IA (l.607-702) | pour chaque effet : une position UTILE (il sort) ET une position inutile (il se tait) ; l.691 **fige la signature** de `bonusPlan` (pas de `nextDice`) | prouve les deux moitiés (pas un bot qui joue toujours) ; MAIS 3 assertions conditionnelles `if (plan)` (voir findings) | OK (note) |

## (c) Findings

- L'un des meilleurs fichiers du lot : VRAI moteur `Match` + vrais `bonus`/`captains`/`ai`,
  dés forcés → **déterminisme total**, aucun `setTimeout`, aucun `Date.now`, aucune
  dépendance à l'aléa ou à l'horloge. Assertions exactes, snapshots vérifiés des deux
  côtés, cas d'invalidité et de double-commande couverts.
- **Ressources : aucun leak malgré l'absence de `clearTimers()`.** CONFIG n'a pas
  d'`awayMs` → `armAway()` (match.js) sort par `if (!this.config.awayMs) return;` sans
  poser de timer ; les parties sont multi (deux humains) pilotées à la main, donc aucun
  tour d'IA ne planifie de `later()`. Correct par construction — ne pas ajouter de
  `clearTimers` par cargo-cult, mais le savoir si un jour ce fichier gagne un `awayMs`.
- **effets2.test.js:628 | assertion conditionnelle (faussement vert partiel)** :
  ```js
  const plan = ai.planEffet('B012', mienne, sienne, { die: 1, quarters:[1,1,1,1] });
  if (plan) assert.strictEqual(plan.face, 2, 'un 1 ne peut que monter d un cran');
  ```
  Si une régression faisait renvoyer `null` à `planEffet`, **aucune assertion ne
  s'exécute** et le test passe. Il vérifie « SI elle joue, jamais une face illégale »,
  pas « elle joue ». C'est un contrôle correctement étroit (anti-boucle), mais il ne
  peut pas attraper « l'IA n'utilise plus jamais B012 ». Contrairement à l.613/619
  (unconditionnelles), celui-ci est vacant sur la branche null.
- **effets2.test.js:701-702 | mineur** | `if (plan) assert.ok(!('nextDice' in plan))` est
  aussi conditionnel, mais l'assertion PRINCIPALE `assert.ok(!contexte.nextDice)` (l.701)
  est inconditionnelle et porte l'essentiel du test. Acceptable.
- Async : tous les `activateBonus`/`pickFace`/`pickCell` sont `await`és ; les rejets
  seraient remontés par node:test. Pas de callback différé non protégé.

**Verdict : OK (1 assertion conditionnelle partiellement vacante l.628 ; sinon exemplaire)**
