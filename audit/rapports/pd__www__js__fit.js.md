# Audit — pd/www/js/fit.js (296 lignes)

Fichier lu en entier. Lot annonce **14 fonctions**, **10 trouvées**. Écart -4 : lu intégralement, aucune fonction manquée — l'écart vient du compteur du lot (probablement des appels/boucles comptés comme fonctions).

## (a) Fonctions

| nom | ligne |
|---|---|
| surcout | 50 |
| surcoutLarge | 64 |
| plafondCase | 86 |
| ecarts | 92 |
| apply | 102 |
| scaleText | 258 |
| schedule | 266 |
| (arrow) `requestAnimationFrame(() => ...)` | 268 |
| startFitting | 275 |
| (arrow) `orientationchange, () => setTimeout(schedule, 260)` | 278 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| surcout | mesure l'habillage vertical d'un plateau (bordures, gaps, plaques) | garde `!board`→0 ; `parseFloat('0')` en repli ; `scores` optionnel | OK |
| surcoutLarge | mesure l'habillage horizontal d'un plateau | garde `!board`→0 ; repli `'0'` | OK |
| plafondCase | plafond de taille de case (min 104 ou côté/4.2) | `Math.min/max` sûrs | OK |
| ecarts | somme des rowGap (enfants dans le flux, -1) | ignore absolus/hidden ; `Math.max(0,...)` | OK |
| apply | calcule et pose `--dc-cell` selon la mesure | gardes `!wrap/!arena/!boards` ; divisions par `rangees`(3/6) et `colonnes`(≥1 via `Math.max(1,...)`) → jamais 0 | OK |
| scaleText | pose `--pd-ui` (échelle texte) selon le plus petit côté | bornée MIN/MAX | OK |
| schedule | débounce via rAF (`pending`) | `pending=0` AVANT `apply()` → si apply lève, prochaine planif OK | OK |
| arrow l.268 | callback rAF : reset pending + apply | protégé (pending déjà remis) | OK |
| startFitting | branche resize/orientation/ResizeObserver/MutationObserver | **observers jamais déconnectés** — voir finding | OK (mineur) |
| arrow l.278 | replanifie après rotation (+260 ms) | — | OK |

## (c) Findings

- **fit.js:280-295 | fuite ressource (mineure / cosmétique)** | `new ResizeObserver(schedule)` (l.281) + `new MutationObserver(schedule).observe(body, {childList,subtree})` (l.294) jamais `disconnect()` | Vivent toute la vie de la page. Acceptable (page unique, `#dicewrap` non recréé), mais aucun teardown : si le shell était reconstruit, les anciens observers subsisteraient. `MutationObserver` sur `subtree:true` peut tirer souvent → amorti par le débounce rAF de `schedule`. Non bloquant.
- Concurrence : `apply()` toujours via rAF (mono-thread) → pas d'invariant cassé. OK.

**Verdict : OK**
