# Audit — pd/www/js/pages/dice_board.js (392 lignes)

Fichier lu en entier. Lot annonce **43 fonctions**. Trouvées : **12 fonctions nommées/exportées + 4 méthodes de classe `Sfx` + ~15 callbacks arrows** ≈ 31. Écart -12 : lu intégralement, aucune fonction manquée — écart de comptage du lot.

## (a) Fonctions

| nom | ligne | | nom | ligne |
|---|---|---|---|---|
| dieFace | 26 | | freeCellOf | 258 |
| cupArt | 35 | | blastCells | 281 |
| cellsOfColumn | 48 | | Sfx.constructor | 320 |
| buildBoard | 63 | | Sfx.taire | 350 |
| parureDuPlateau | 114 | | Sfx.load | 357 |
| renderBoard | 119 | | Sfx.play | 371 |
| markPlaced | 176 | | | |
| tumble | 212 | | | |
| showLanding | 240 | | | |
| clearLanding | 252 | | | |

Callbacks (setTimeout/forEach/addEventListener) : l.153, 188, 195, 200, 222, 223 (setInterval), 253, 254, 285, 287, 288, 304, 341 (visibilitychange), 387 (ended), 389 (play().catch).

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| dieFace | HTML `<img>` d'une face de dé (valeur, hot, skin) | **concatène `value`/`skin` dans du HTML sans échappement** — voir #1 | FAILLE |
| cupArt | HTML du gobelet (repos/prêt) | statique | OK |
| cellsOfColumn | indices d'une colonne | pur | OK |
| buildBoard | construit le DOM d'un plateau vide | `createElement`/`dataset` (pas d'innerHTML) | OK |
| parureDuPlateau | parure du camp d'un plateau | `parseInt` + `Number.isInteger`, `seat>=0` | OK |
| renderBoard | écrit une grille sur le plateau (diff) | `grid[cell]`/`colScores[col]` non bornés — voir #2 ; `setTimeout` de nettoyage sûr | OK (mineur) |
| markPlaced | anime la pose (chute, poussière, thud) | garde `!box` ; `setTimeout` retirent classes/éléments ; `remove()` sûr sur nœud détaché | OK |
| tumble | roulement des faces avant valeur finale | `setInterval` auto-nettoyé (clearInterval avant `done()`); **pas de garde `!el`** ; double appel → glitch | OK (mineur) |
| showLanding | fantôme d'aperçu de pose | garde `!box` ; `innerHTML=dieFace(...)` (même surface #1) | OK |
| clearLanding | retire fantômes/landing | forEach `remove` sûr | OK |
| freeCellOf | 1re case libre d'une colonne, sinon -1 | pur | OK |
| blastCells | joue l'explosion par case, renvoie le délai de redraw | `onEachBoom()` peut lever — voir #3 ; garde `!box` ; flash retiré via setTimeout | OK (mineur) |
| Sfx.constructor | banque de sons, coupe au passage arrière-plan | **écouteur `visibilitychange` jamais retiré** — voir #5 | OK (mineur) |
| Sfx.taire | coupe toutes les voix en cours | `pause/currentTime` en try/catch ; vide le Set | OK |
| Sfx.load | crée l'`Audio` + délègue au bus | `charger()` non try/catch (init) | OK |
| Sfx.play | joue un son (bus, sinon `<audio>` cloné) | gardes muted/dehors/niveau ; try/catch ; `play().catch` ; borne le volume [0,1] ; voix retirée sur `ended` — voir #6 | OK |

## (c) Findings

1. **dice_board.js:31 (dieFace), utilisé en 140/247/228/235 | état incohérent (injection/XSS latente)** | `return '<img class="dc-face" src="' + base + file + '" alt="" draggable="false">';` avec `file='die_'+value+...` et `base=ART+'skins/'+skin+'/'`, puis inséré via `innerHTML` (renderBoard l.140 `box.innerHTML=dieFace(...)`, showLanding l.247, tumble l.228/235) | `value` (valeur de dé) et `skin` (id de parure, via `parureDuPlateau`→`skinOf`, dice_state.js hors lot) sont concaténés SANS échappement. Si l'un contient `"` (serveur/adversaire hostile, id de parure non contrôlé), on sort de l'attribut `src` et on injecte des attributs/HTML (`onerror=…`) dans le DOM du joueur. Exploitation conditionnée aux garanties de `skinOf`/serveur (valeurs de dé normalement entières). Gravité : état incohérent / faille potentielle.
2. **dice_board.js:124,131,165 (renderBoard) | état incohérent (mineur)** | `const v = grid[cell];` / `value = grid[cell]` / `String(colScores[col])` sans borne de longueur | Un état serveur tronqué produit `die_undefined.png` (image cassée) ou le texte `"undefined"` sur une plaque, au lieu d'un vide. Pas de crash. Mineur.
3. **dice_board.js:291 (blastCells) | état incohérent (mineur)** | `if (onEachBoom) onEachBoom();` avant le vidage de la case (l.295-297) | Si `onEachBoom()` lève, le reste du callback de CE dé (vidage `innerHTML`/`dataset`, flash) ne s'exécute pas — case non nettoyée visuellement pour ce dé ; les autres dés (timeouts indépendants) continuent. Mineur.
4. **dice_board.js:217 (tumble) | cosmétique** | `el.classList.add('dc-tumbling');` sans garde `!el` | `el` null → throw (responsabilité de l'appelant). Concurrence : deux `tumble` sur le même `el` lancent deux intervalles → glitch visuel, chacun se nettoie (clearInterval). Mineur.
5. **dice_board.js:341 (Sfx.constructor) | fuite ressource (cosmétique)** | `document.addEventListener('visibilitychange', () => {...})` jamais retiré | `Sfx` est un singleton (`S.sfx`), mais chaque `new Sfx()` empilerait un écouteur capturant `this`. Cosmétique.
6. **dice_board.js:386-387 (Sfx.play) | fuite (cosmétique)** | `this.voix.add(voice)` retiré sur `ended` (`{once:true}`) | Si `ended` ne se déclenche jamais (lecture bloquée), l'entrée reste dans le Set. Amorti par `taire()` (vidé au passage arrière-plan). Cosmétique.

**Verdict : FAILLES(1) [état incohérent]** (dieFace ; le reste mineur/cosmétique)
