# Rapport d'audit — `srv/test/captains.test.js`

Chemin réel : `/Users/develop/dice-server/test/captains.test.js` — 835 lignes.
Lot annonce **102 fonctions**. Compte réel : **2 helpers** (`table`, `started`) + **47 cas `test(...)`** = 49 fonctions nommées. L'écart (102 vs 49) vient des très nombreux arrows inline : hooks `broadcast`/`consume`/`finish`, chaînes `.then(...)`, prédicats `.filter/.map/.find/.some/.every`. Écart noté, non bloquant.

Nature : suite `node:test` la plus fournie du lot, sur `src/game/match` (+ `rules`, `captains`, `ai`, `bonus`, `bilan`) — un trait de capitaine par test, plus le comportement de pause/reconnexion et l'IA.

## a) Liste des fonctions (nom abrégé | ligne)

| ligne | test | ligne | test |
|-------|------|-------|------|
| 26 | `table` (helper) | 439 | quinze capitaines / seuils |
| 45 | `started` (helper) | 452 | chaque capitaine offre un effet |
| 55 | capitaine inconnu → défaut | 466 | Barbe-Noire gèle une colonne |
| 61 | Mary Read relance gratuite | 487 | geler colonne pleine refusé |
| 78 | longue-vue = effet (Lionne) | 495 | pas deux gels à la fois |
| 89 | effet offert montre le dé | 503 | Anne Bonny presse le tour |
| 102 | ce qu'on a vu sort | 533 | pas deux fois le même tour |
| 115 | longue-vue se referme | 545 | Black Bart échange |
| 126 | sans trait, longue-vue refusée | 557 | pas d'échange case vide |
| 138 | colonne bénie +15 % | 568 | Ching Shih deux colonnes |
| 150 | Grace O'Malley bénédiction | 583 | bordée comptée au bon siège |
| 169 | bénir colonne vide | 602 | bordée colonnes vides refusée |
| 184 | Henry Morgan vole un tour | 610 | Levasseur maudit -15 % |
| 203 | pas deux tours d'affilée | 624 | malédiction dure jusqu'à la fin |
| 212 | tour sauté relance le dé | 636 | bénie ET maudite se composent |
| 222 | trait de Grace non contagieux | 654 | pas geler la dernière colonne |
| 230 | Calico Jack dé d'avance | 670 | colonne gelée sur la MACHINE |
| 238 | bordée à deux dés | 706 | raser sa propre colonne |
| 250 | IA canonne colonne dangereuse | 731 | effet vendu avec son capitaine |
| 259 | IA relance dé faible | 752 | trait compte dans les 3 effets |
| 265 | IA sans budget ne joue rien | 774 | armer ne relance pas la pendule |
| 272 | IA joue son effet | 812 | rearmement borné à 3 effets |
| 313 | humain annonce son effet | | |
| 343 | IA canonne une paire | | |
| 357 | IA nettoie un 1 | | |
| 368 | coupure → PAUSE | | |
| 412 | instantané porte la pause | | |

## b) Grille par fonction

| groupe | rôle | risques | statut |
|--------|------|---------|--------|
| `table` / `started` | Montent un `Match` multi, quarts fixés (pas de tirage aléatoire dans les scores) | hooks sûrs ; `started` fige `quarters=[1,1,1]` pour ne pas mesurer un tirage | OK |
| tests synchrones (55, 138, 230, 250-265, 343-357, 412, 439-452, 670, 706, 731…) | Vérifient traits/IA sur état forcé | synchrones, assertions bornées | OK |
| tests async à effets (61-212, 466-668, 752…) | `return …then(…)` ou `await activateBonus/pickCell` | promesse **retournée/awaitée** → un rejet = échec de test, pas unhandled | OK |
| tests à pendule (503, 533, 774, 812) | Effets qui raccourcissent/relancent le tour, `awayMs:20000` | **`try { … } finally { clearTimers() }`** → pas de timer fuité même sur échec | OK |
| test pause (368) | `awayMs:30000`, arme/pause/reprend la pendule | nettoyage `match.destroy()` en **dernière** ligne, pas en `finally` (voir C1) | OK |

## c) Findings détaillés

Aucune **FAILLE** de production. Les tests async retournent ou `await`ent tous leur promesse (grille pt 2 : aucun rejet non géré, aucun `await` manquant repéré) ; les tests à pendule longue sont majoritairement protégés par `try/finally` (grille pt 6).

### C1 — Test « coupure → PAUSE » (l.368) : nettoyage `match.destroy()` hors `try/finally` alors qu'un timer de 30 s est armé
`srv/test/captains.test.js:368-410` — gravité **cosmétique / hygiène de test**

Ce test met `awayMs:30000` (l.376), appelle `match.armAway()` (timer réel de 30 s), puis en fin ré-arme la pendule (`setConnected(0, true)`, l.~404) et nettoie par `match.destroy()` en **dernière instruction** (l.409). Si l'une des assertions finales échoue avant la l.409, la pendule de 30 s **n'est pas nettoyée** : `node --test` attend alors que la boucle d'événements se vide, et toute la suite reste suspendue jusqu'au déclenchement du timer. C'est exactement le mode d'échec que le fichier documente et corrige ailleurs par `try { … } finally { match.clearTimers(); }` (voir les commentaires l.526-528 « SANS CECI, UNE PENDULE SURVIT A L ECHEC DU TEST », et l.774). Ce test-ci (ainsi que, dans une moindre mesure, le test l.670 qui appelle `clearTimers()` en dernière ligne mais sans `awayMs` long) n'a pas suivi la même discipline. Sans impact en production ; à ne se manifester que sur un test déjà en échec. Grille pts 3/6.
