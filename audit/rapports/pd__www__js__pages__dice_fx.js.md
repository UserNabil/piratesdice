# Rapport d'audit — pd/www/js/pages/dice_fx.js

Fichier lu en entier par tranches (1-200, 200-400, 400-600, 600-800, 800-933).
Rôle : ce que la partie ANNONCE — bannières, bulles de réplique/humeur, effets de
capitaine, la pendule/mèche du tour et l'affichage de la longue-vue. Module de
présentation ; le serveur est l'autorité sur les données.

## a) Liste des fonctions

| nom | ligne |
|---|---|
| tempsDeLecture | 45 |
| poser | 59 |
| banner | 91 |
| shake | 111 |
| buzz | 122 |
| nomDuSiege | 127 |
| moodArt (export) | 157 |
| bulleImage | 163 |
| bubble | 180 |
| sendMood (export) | 239 |
| announce (export) | 248 |
| unEffet | 264 |
| annonceBonus | 483 |
| (CORDE 'load' handler) | 601 |
| traceDuJonc | 612 |
| longueurDuTrace | 712 |
| morceauxDeLaCorde | 733 |
| peindreCorde | 762 |
| brulerLaMeche | 791 |
| poserSecondes | 809 |
| stopClock | 814 |
| startClock (export) | 828 |
| renderForesee (export) | 913 |

Écart de comptage : le lot annonce 69 fonctions ; je recense 23 fonctions nommées
+ ~10 arrow-callbacks inline (chasser, peindre, handlers pointerdown/setTimeout,
MutationObserver, forEach). La métrique auto (69) sur-compte fortement (chaque `=>`
et probablement les branches). Aucune fonction manquée à la lecture intégrale.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| tempsDeLecture | durée d'affichage selon longueur du texte | `(texte||'')` garde null ; bornes min/max | OK |
| poser | pose un message, le chasse au clic/délai | garde `fini` anti-double ; clearTimeout ; removeChild sous garde parentNode | OK |
| banner | bannière centrale anti-répétition 400ms | garde `!arene` ; textContent (pas d'injection) | OK |
| shake | secoue l'arène | garde arène + reduced-motion ; setTimeout sur nœud possiblement détaché (inoffensif) | OK |
| buzz | vibration téléphone | try/catch + garde vibrate/muted | OK |
| nomDuSiege | nom du joueur d'un siège | chaîne de gardes `&&` + repli i18n | OK |
| moodArt | URL de l'image d'humeur | `MOODS[i]||MOODS[0]` borne l'index | OK |
| bulleImage | bulle image d'humeur | `MOODS[index]||MOODS[0]` ; src/alt via propriétés | OK |
| bubble | bulle au-dessus d'un portrait, 1 par siège | garde `!carte` ; remplace l'ancienne ; MutationObserver auto-disconnect | OK |
| sendMood | envoie l'humeur au serveur | garde `S.net` ; retour send ignoré (cosmétique) | OK |
| announce | parcourt les effets et les dit | try/catch PAR effet, mais `for..of fx` non gardé si `fx` non itérable | OK (voir findings) |
| unEffet | dispatch d'un effet vers son annonce | appelé sous try/catch d'announce ; textContent/props partout | OK |
| annonceBonus | compose la réplique de capitaine d'un bonus | gardes `S.state && ...` ; createTextNode (pas d'injection) | OK |
| CORDE load | repeint la mèche à l'arrivée de l'image | garde `if(clock)` ; `getComputedStyle(clock.parentElement)` suppose le parent | OK |
| traceDuJonc | calcule le tracé SVG du jonc | gardes width/height/svg ; parse avec repli | OK |
| longueurDuTrace | longueur mémoïsée du tracé | mémo sur `__len` | OK |
| morceauxDeLaCorde | découpe mémoïsée de la corde | atteint seulement après garde CORDE.complete/naturalWidth | OK |
| peindreCorde | peint la corde restante | gardes toile/trace/CORDE ; contexte 2d | OK |
| brulerLaMeche | pose corde + flamme pour une part | gardes `!trace`/`!total`/`!flamme` | OK |
| poserSecondes | écrit les secondes restantes | garde `carte && querySelector` ; Math.max(0,...) | OK |
| stopClock | arrête l'intervalle et nettoie les classes | clearInterval + garde game | OK |
| startClock | arme la pendule du tour | stopClock d'abord (pas de double interval) ; `st.phase` non gardé si st absent | OK (voir findings) |
| renderForesee | affiche le prochain dé (longue-vue) | gardes carte/phase/foresee ; `dieFace` non gardé ; label `esc` | OK |

## c) Findings détaillés

Aucune FAILLE bloquante active. Trois gaps défensifs de faible gravité (entrées
supposées valides car serveur-autorité et appelants contrôlés) :

1. `announce` — dice_fx.js:248 — gravité : cosmétique (au pire un tour sans
   décor). Le try/catch protège CHAQUE effet (intention documentée l.49-57
   « un effet perdu vaut mieux qu'un tour perdu ») mais l'itération elle-même
   `for (const f of fx)` n'est pas gardée : `announce(null/undefined)` ou un `fx`
   non itérable lève un TypeError qui échappe à la résilience voulue. Impact
   limité : l'annonce arrive APRÈS le dessin de la table (l.46), donc le plateau
   reste affiché même si announce échoue.

2. `startClock` — dice_fx.js:828-831 — gravité : cosmétique. `st.phase`,
   `st.turn`, `st.awayTotal`, `st.awayMs` déréférencés sans garde sur `st`.
   `startClock(undefined)` lèverait. L'appelant passe toujours l'état serveur.
   Point positif : `stopClock()` en tête empêche tout intervalle en double, et
   `peindre` (l.881) s'auto-arrête si `S.state.phase !== 'playing'`.

3. `renderForesee` — dice_fx.js:913 — gravité : cosmétique. `dieFace` (callback)
   non gardé : si absent alors que `st.foresee` est défini, `dieFace(...)` lève.
   La sortie de `dieFace` est injectée en `innerHTML` (l.131) : sûre tant que ce
   callback (fourni par dice_match) produit du HTML maîtrisé ; le label est `esc`.

Note ressources : `bubble` crée un MutationObserver par bulle qui se déconnecte
tout seul au retrait du nœud, et `poser`/`shake` posent des timers qui se
neutralisent (garde `fini`, garde `parentNode`). Pas de fuite constatée.

Statut fichier : OK.
