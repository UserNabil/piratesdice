# Audit — srv/test/match.test.js (363 lignes)

Fichier de test lu en entier. Framework `node:test`. Lot annonce **50 fonctions**,
**~19 rappels `test` + ~7 helpers + de nombreux arrows inline** (broadcast/consume/
finish, `.filter`/`.some`/`.map`/`.sort`, promesses). La métrique auto gonfle
fortement via `=>` ; écart signalé, non bloquant.

## (a) Fonctions (principales)

| nom | ligne |
|---|---|
| `makeMatch` (+ hooks broadcast/consume/finish) | 13 |
| test « la partie demarre des que les deux sieges sont la » | 52 |
| test « une partie solo demarre elle aussi » | 58 |
| `started` | 64 |
| test « you cannot place before rolling… » | 70 |
| test « a placed die wipes the matching enemy dice » | 81 |
| test « two columns wiped at once… » | 97 |
| test « the match ends when a board is full… » | 113 |
| test « a forfeit zeroes the quitter… » | 136 |
| test « B001 rerolls, consumes exactly one item… » | 145 |
| test « B001 needs a rolled die » | 162 |
| test « a bonus you do not own is refused… » | 167 |
| test « a captain cannot play another captain effect » | 175 |
| test « B002 waits for a cell… » | 185 |
| test « B003 clears an enemy die… » | 210 |
| test « the bonus allowance is capped per match » | 223 |
| test « placing a die cancels a pending bonus » | 234 |
| `colonnes` | 247 |
| test « a solo match played to the end terminates » | 249 |
| `makeAwayMatch` | 279 |
| `wait` | 301 |
| `jusqua` | 311 |
| test « un joueur absent … l IA joue son tour » | 320 |
| test « un joueur qui agit ne se fait pas remplacer » | 330 |
| test « the AI plays again when the human comes back » | 349 |

## (b) Ce que ça couvre / fiabilité

| nom | rôle | risques | statut |
|---|---|---|---|
| `makeMatch` | VRAI `Match` + hooks capturant states/fx/finished/consumed ; **fixe `match.quarters=[1,1,1]`** pour dé-flakiser les scores | bonne intention ; MAIS 3 valeurs pour un plateau à **4 colonnes** (voir findings) | OK (note) |
| l.52-134 (mécanique) | démarrage, ordre roll/place, destruction même-valeur (fx cells/seat), fin sur plateau plein + score exact | assertions **exactes** ; l.118 remplit `CELLS-1` (pas « 8 ») ; math de score dérivée des constantes | OK |
| l.136-242 (effets) | forfait, B001 (relance via `nextDice`, 1 conso, 1 usage), B001 sans dé, non-possédé refusé, effet d'un AUTRE capitaine refusé avant plafond, B002/B003 (pending complet `identify`/`premiere`/`faces`), plafond `bonusJoues`, pose annule un pending | assertions exactes et riches (snapshot pending figé champ par champ) ; tous les async `await`és | OK |
| l.249 solo | boucle bornée (`guard<200`) jusqu'à plateau plein ; `colonnes()` dérivé de `COLUMNS` | garde anti-boucle ; assertions sur phase OVER + isFull + finished | OK |
| `jusqua` (l.311) | **attend une CONDITION** (poll 20 ms, plafond 4 s) au lieu d'une durée fixe | correctif anti-flaky exemplaire, appliqué à l.320 | OK |
| l.320 IA absent | attend `turn` changé via `jusqua`, vérifie fx `away` + `clearTimers()` | robuste à la charge ; timers libérés | OK |
| l.330 « qui agit n'est pas remplacé » | 5×(`wait(40)` + `armAway()`), assert aucun fx `away` | **FRAGILE au timing** (voir findings) : dépend que chaque `wait(40)` finisse avant la pendule 60 ms | OK (fragile) |
| l.349 « l'IA rejoue au retour » | `setConnected` off/on, puis **`setTimeout(30)` FIXE**, assert un dé posé | **FRAGILE au timing** (voir findings) ; pas de `clearTimers()` mais leak improbable (voir findings) | OK (fragile) |

## (c) Findings

- Le gros du fichier est **excellent** : VRAI moteur `Match`, assertions exactes et
  riches (fx, pending champ par champ, scores dérivés des constantes), tous les
  async `await`és, `quarters` fixés pour ôter l'aléa des scores, boucle solo bornée.
- **match.test.js:330-341 | test fragile (timing / faux ROUGE sous charge)** : la
  boucle `wait(40)`+`armAway()` suppose que chaque réveil arrive **avant** la pendule
  d'absence (`awayMs=60`, match.js `armAway`). Or `node --test` lance les fichiers
  EN PARALLÈLE et l'en-tête du fichier lui-même (l.303-310) prévient que le banc de
  search.test.js « occupe la machine une seconde entière » : si un `wait(40)` déborde
  au-delà de 60 ms (famine de la boucle d'événements), la pendule tire, un fx `away`
  paraît, et les deux assertions échouent. C'est **exactement** la classe de flakiness
  que le fichier a corrigée pour l.320 via `jusqua` — mais l.330 n'a pas été convertie.
- **match.test.js:360 | test fragile (durée fixe)** : `await new Promise(r => setTimeout(r, 30))`
  puis assert que l'IA a posé un dé. C'est **l'anti-pattern que ce fichier condamne**
  explicitement (l.303-310) : une attente FIXE de 30 ms au lieu d'attendre la condition
  (« un dé de plus sur le plateau »). Sous charge, 30 ms peuvent ne pas suffire au tour
  d'IA asynchrone → faux ROUGE. À réécrire avec `jusqua(() => match.grids[1].filter(...)>avant)`.
- **match.test.js:349-363 | hygiène (leak improbable)** | ce test ne termine PAS par
  `match.clearTimers()`, contrairement à l.320/l.330. En pratique le risque de fuite
  est faible : `CONFIG` n'a pas d'`awayMs` (→ `armAway()` sort sans poser de timer,
  match.js) et le tour d'IA est planifié avec `aiThinkMs=0`, donc son `later()` se
  déclenche et s'auto-supprime pendant l'attente de 30 ms. Incohérence de style à
  aligner sur l.320/l.330 par prudence, sans gravité avérée.
- **match.test.js:37 | cosmétique (couplage latent)** | `match.quarters = [1, 1, 1]`
  n'a que **3 valeurs pour 4 colonnes** (`rules.COLUMNS=4`). Inoffensif aujourd'hui
  car `columnScore` ignore un quart absent (`typeof quarts[col]==='number'` → sinon ×1),
  donc la 4e colonne n'est simplement pas pondérée. Un neutre correct serait `[1,1,1,1]` :
  si `columnScore` changeait le défaut d'un quart manquant, les scores attendus casseraient.

**Verdict : OK (2 tests fragiles au timing — l.330, l.349 ; 1 couplage latent quarters ;
hygiène clearTimers incohérente sans gravité avérée)**
