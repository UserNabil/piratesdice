# Audit — srv/test/replay.test.js (184 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **21 fonctions**,
**~21 comptées** (1 helper `table` + 8 rappels `test` + arrows inline des hooks
`broadcast`/`consume`/`finish` et des `.find`/`.filter`. Métrique cohérente via `=>`).

## (a) Fonctions

| nom | ligne |
|---|---|
| `table` | 23 |
| test « le journal retient chaque lancer et chaque pose, dans l ordre » | 34 |
| test « le journal se rejoue et retombe sur le meme score » | 52 |
| test « l en-tete porte de quoi rejouer » | 84 |
| test « le journal ne gonfle pas sans fin » | 100 |
| test « un tour perdu par la pendule consomme le gel » | 118 |
| test « sans gel, un tour perdu … rend la main a l autre » | 135 |
| test « le de d ouverture ne detruit pas en rediffusion » | 150 |
| test « la rediffusion garde le drapeau offert » | 169 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `table` | vrai `Match` multi + 2 sièges humains, hooks stubbés (`broadcast`/`consume`/`finish`) | teste le VRAI moteur `Match` et `rediffusion` | OK |
| l.34 | le journal restitue rolls+poses dans l'ordre ; `attendu` construit depuis les vraies valeurs jouées | **auto-cohérent** (journal comparé à ce qui s'est réellement passé) → non flaky même si RNG=Math.random ; `deepStrictEqual` | OK |
| l.52 | rejouer le journal via les seules RÈGLES redonne le score enregistré (avec `destroyValueInColumn`) | `vrai` et `refait` dérivés des mêmes coups → robuste à l'aléa ; assertion exacte | OK |
| l.84 | en-tête format v2 : mode, capitaines, joueurs, **quarts (4)**, parures (2) | assertions exactes sur les champs indispensables au rejeu | OK |
| l.100 | plafond du journal : 500 lignes de bruit → `length <= 200` | assertion de borne réelle | OK |
| l.118 | le gel se consomme même sur un tour perdu à la pendule (`playForAway`) ; main rendue au geleur | couvre le bug DEUX-chemins ; assertions exactes ; `async` **sans `await`** (superflu, inoffensif) | OK |
| l.135 | sans gel, `playForAway` rend la main à l'autre | assertion exacte | OK |
| l.150 | dé d'ouverture ne détruit pas en rediffusion (1 dé reste par plateau) | teste `rediffusion.images` sur un journal forgé | OK |
| l.169 | rediffusion conserve le drapeau `offert` (B007 offert vs B001 payé) | assertions exactes (les hauts faits lisent ces images) | OK |

## (c) Findings

- Aucun test faussement vert : tout appelle le **vrai** `Match`/`rules`/`rediffusion`.
  Les deux tests dirigés par RNG (l.34, l.52) sont **auto-cohérents** — ils comparent
  le journal/rejeu à ce qui a réellement été joué — donc reproductibles même si le
  RNG n'est pas semé (`rng: null`).
- **Hygiène ressources : bonne.** Chaque test qui crée un `Match` appelle
  `match.clearTimers()` (l.49/81/97/105/132/140) → pas de timer pendant qui garde le
  process en vie ou fuit entre tests. Les tests l.150/169 ne créent pas de match
  (journal forgé + `rediffusion.images`) → aucun timer.
- **replay.test.js:118 | cosmétique** | test marqué `async` sans aucun `await` :
  le mot-clé est inutile (tout est synchrone). Sans effet, à nettoyer.
- **replay.test.js:126 | cosmétique** | dépend de l'hypothèse « un seul `playForAway`
  reste sous le seuil d'abandon (`awayTurns`) ». Vrai avec la config par défaut ;
  déterministe. Noté.

**Verdict : OK**
