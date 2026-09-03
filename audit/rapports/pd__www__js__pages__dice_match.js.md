# Rapport d'audit — pd/www/js/pages/dice_match.js

Fichier lu en entier par tranches (1-200, 200-400, 400-600, 600-800, 800-1000,
1000-1200, 1200-1400, 1400-1600, 1600-1831). Rôle : LA TABLE — dessine les deux
plateaux, le gobelet, la cale/barillet des effets, les cartes joueur, la pendule,
le ciblage, à partir de l'état autoritatif du serveur (`onMatch`/`onState`) et de
la liste d'effets `fx`.

## a) Liste des fonctions (nommées)

| nom | ligne | | nom | ligne |
|---|---|---|---|---|
| onMatch (export) | 29 | | avaler | 1115 |
| buildGame | 56 | | caleOuverte | 1123 |
| closeFan | 289 | | fermerCale | 1128 |
| anglesEventail (export) | 337 | | ouvrirCale | 1137 |
| calerEventail | 442 | | basculerCale | 1151 |
| openFan | 504 | | renderExit | 1156 |
| wireMoodFan | 554 | | direEtat | 1226 |
| onState (export) | 582 | | oublierEtat (export) | 1240 |
| paint | 662 | | renderTurn | 1255 |
| casesGelees | 712 | | renderCup | 1295 |
| casesEmbrumees | 733 | | peutManoeuvrer | 1362 |
| casesSousCoque | 746 | | quartsTousEgaux | 1374 |
| renderGel | 780 | | ratelierAuDebut (export) | 1394 |
| renderMaudit | 821 | | disposerBarillet | 1425 |
| stageBoards | 837 | | renderBonusRack (export) | 1541 |
| popChangedScores | 864 | | renderArrondi | 1647 |
| jouable | 931 | | renderQuarters | 1656 |
| stockMarkup | 935 | | renderBoost | 1679 |
| renderPlayerCard | 980 | | renderTargeting | 1692 |
| meche | 1072 | | consigneDeVisee | 1787 |
| | | | renderFaces | 1804 |

Écart de comptage : le lot annonce 180 ; je recense ~41 fonctions nommées + un
très grand nombre d'arrows inline (handlers pointer/click/mouse, `.forEach`,
`.map`, `.filter`, callbacks `tient`/`placer`/`habiller`/`down`/`move`/`up`, etc.).
La métrique auto (180) compte chaque `=>`. Aucune fonction nommée manquée à la
lecture intégrale.

## b) Analyse par fonction (résumé ; détails en c)

| nom | rôle | risques | statut |
|---|---|---|---|
| onMatch | démarre une table | fait confiance à `m.seat`/`m.state` (serveur) ; buildGame relance le leak | OK (voir c) |
| buildGame | construit l'arène + câble les gestes | 2 `document.addEventListener` anonymes non retirés, par match | FAILLE |
| closeFan/openFan | éventail des humeurs | `fanTimer` unique, cleared dans closeFan | OK |
| anglesEventail/calerEventail | géométrie de l'éventail | `combien<=0`→[] ; bornes/repli ; boucles finies | OK |
| wireMoodFan | appui long portrait | dédup via `dataset.fanCable` sur élément persistant | OK |
| onState | applique un état + effets | `fx||[]` ; `S.sfx.play` non gardé (l.614) ; setTimeout one-shot | OK (voir c) |
| paint | repeint tout | garde `!S.state||S.seat<0` ; sous-rendus gardent leurs éléments | OK |
| casesGelees/Embrumees/SousCoque | cases sous couche | gardes phase + accès `?:` | OK |
| renderGel | pose/retire les 3 couches | retire l'ancien `.dc-gel` ; ne recrée pas si déjà posé | OK |
| renderMaudit/renderBoost/renderQuarters/renderArrondi | plaques de colonne | gardes board/parentNode ; parse `dataset` | OK |
| stageBoards | éclaire le plateau actif | fondé sur le TOUR, pas la phase (corrigé) | OK |
| popChangedScores | anime les scores changés | largeur lue dynamiquement ; gardes | OK |
| jouable | objet jouable en partie | whitelist `CALE` + repli `/^B\d/` | OK |
| stockMarkup | pastilles d'effets restants | `Math.max/min` bornent `n` ; images constantes | OK |
| renderPlayerCard | carte joueur | `esc` partout ; `repeat(p.etoiles)` non borné (l.1051) | OK (voir c) |
| meche | fabrique le jonc/mèche | statique | OK |
| avaler | avale le clic qui suit un geste de fermeture | `once:true` + removeEventListener à 700ms | OK |
| caleOuverte/fermerCale/ouvrirCale/basculerCale | état de la cale | gardes `!rack` | OK |
| renderExit | sortie/rejouer en fin | gardes `!quit` ; `if(S.net)` avant send | OK |
| direEtat/oublierEtat/renderTurn | alerte de tour | `minuteurEtat` unique + clear ; `textContent` (pas d'injection) | OK |
| renderCup | gobelet/dé | gardes `!cup` ; réécrit si changé | OK |
| peutManoeuvrer/quartsTousEgaux | prédicats B014/B016 | gardes tableau | OK |
| disposerBarillet | pose les jetons du barillet | écouteurs sur nœuds recréés (pas d'empilement) ; math bornée | OK |
| renderBonusRack | dessine la cale | `IMPOSSIBLE` construit avec gardes `&&` ; whitelist B002/B003+offert | OK |
| renderTargeting | ciblage/visée | `$('#dc-screen-game')` non gardé (l.1694) ; reste gardé | OK (voir c) |
| consigneDeVisee/renderFaces | consigne + faces B012 | `Array.isArray(pending.faces)` ; `if(!S.net) return` | OK |

## c) Findings détaillés

### FAILLE 1 — buildGame : écouteurs `document` fuités à chaque partie
- dice_match.js:243 `document.addEventListener('pointercancel', () => { if (caleOuverte()) fermerCale(); });`
- dice_match.js:254 `document.addEventListener('pointerdown', (ev) => { ... }, true);`
- Gravité : fuite ressource (dégradation progressive) + effet fonctionnel mineur.
- `buildGame` est appelé par `onMatch` une fois PAR partie (et à chaque reprise
  `resumed`). Ces deux écouteurs sont posés sur `document`, anonymes, et JAMAIS
  retirés (le seul `removeEventListener` du fichier, l.1120, concerne le garde
  à usage unique d'`avaler`). À chaque nouvelle table, une paire supplémentaire
  s'ajoute : après N parties dans une session, N `pointerdown` (capture) + N
  `pointercancel` s'exécutent à chaque geste.
- Effet fonctionnel : pendant une visée, un clic « dans le vide » fait exécuter
  la branche `if (vise && S.net) S.net.send({ t: 'unbonus' })` de CHAQUE écouteur
  survivant → N envois `unbonus` dupliqués, et N appels `fermerCale()`/`avaler()`.
  Le serveur absorbe les doublons (idempotent) mais le travail par geste croît
  avec le nombre de parties jouées.
- Preuve que c'est une incohérence, pas un choix : `wireMoodFan` (l.554-559)
  câble ses propres écouteurs UNE SEULE FOIS grâce au drapeau
  `ecran.dataset.fanCable` posé sur `#dc-screen-game` — élément qui PERSISTE
  (buildGame ne réécrit que son `innerHTML`). Le même garde manque aux deux
  `document.addEventListener`. Correctif naturel (non appliqué — audit) : les
  poser une seule fois (drapeau) ou les retirer à la sortie de partie.

### Observation 2 — renderPlayerCard : `repeat(p.etoiles)` non borné
- dice_match.js:1051 `'⭐'.repeat(p.etoiles) + '☆'.repeat(Math.max(0, 5 - p.etoiles))`
- Gravité : crash process (théorique). `p.etoiles` vient de l'état serveur ; une
  valeur énorme ou négative-non-entière ferait lever `RangeError: Invalid count`
  (ou allouerait une chaîne géante). Serveur de confiance (envoie 0-5) → très
  faible probabilité, mais aucune borne défensive côté client.

### Observation 3 — renderTargeting : `$('#dc-screen-game')` non gardé
- dice_match.js:1694 `const game = $('#dc-screen-game'); game.classList.toggle(...)`
- Gravité : cosmétique. Toutes les autres fonctions de rendu gardent `if(!el) return`;
  celle-ci déréférence `game` sans garde. `#dc-screen-game` persiste dans le shell
  donc sûr en pratique ; inconsistance de style.

### Observation 4 — retours de `envoyerCoup`/sons non gardés
- Les `envoyerCoup(...)` (place/cell/roll/bonus/face) ignorent leur retour : un
  envoi échoué en cours de partie perd le coup en silence (le serveur ne fait
  pas avancer l'état → le joueur peut rejouer). Cosmétique.
- `S.sfx.play(...)` non gardé en l.614 alors qu'il l'est ailleurs (`if (S.sfx)`).
  `S.sfx` est un singleton du cœur. Cosmétique.

Points positifs vérifiés : pas de XSS (interpolations `esc()`, `textContent`, ou
ids whitelistés B002/B003/offert ; `dataset` pour le reste) ; `fx` retombe sur
`[]` ; annonces après le dessin ; minuteurs uniques et nettoyés ; `avaler` retire
son garde ; les écouteurs du barillet et du sac sont sur des nœuds recréés (pas
d'empilement) ; `#dc-screen-game` réutilisé (wireMoodFan dédupé).

Statut fichier : FAILLES(1) [fuite ressource — écouteurs document par partie]
