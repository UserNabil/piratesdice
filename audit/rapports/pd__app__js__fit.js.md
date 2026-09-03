# Audit — pd/app/js/fit.js (296 lignes)

Fichier lu EN ENTIER. Lot annonce **14 fonctions** ; **10** trouvées (dont 2 arrows). Écart -4 dû au compteur auto du lot (appels/boucles). Aucune fonction manquée.

## (a) Fonctions

| nom | ligne |
|---|---|
| surcout(wrap) | 50 |
| surcoutLarge(wrap) | 64 |
| plafondCase() | 86 |
| ecarts(boite, cs) | 92 |
| apply() | 102 |
| scaleText(wrap) | 258 |
| schedule() | 266 |
| (arrow) rAF `() => { pending=0; apply(); }` | 268 |
| startFitting() (export) | 275 |
| (arrow) orientationchange `() => setTimeout(schedule, 260)` | 278 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| surcout | mesure l'habillage vertical d'un plateau | garde `!board`→0 ; repli `parseFloat('0')` ; `scores` optionnel | OK |
| surcoutLarge | mesure l'habillage horizontal | garde `!board`→0 ; replis `'0'` | OK |
| plafondCase | plafond de taille de case (max 104 ou côté/4.2) | `Math.min/max` sûrs, pas de division | OK |
| ecarts | somme des rowGap des enfants dans le flux (-1) | ignore absolus/hidden ; `Math.max(0,…)` | OK |
| apply | calcule et pose `--dc-cell` | gardes `!wrap/!arena/!boards` ; `rangees`∈{3,6}, `colonnes`≥1 (`Math.max(1,…)`) → jamais /0 ; `cell` borné `MIN_CELL` | OK |
| scaleText | pose `--pd-ui` selon le plus petit côté | borné MIN/MAX_SCALE | OK |
| schedule | débounce via rAF (`pending`) | `pending=0` posé AVANT `apply()` dans le callback → si apply lève, la planif suivante repart | OK |
| arrow l.268 | callback rAF : reset pending + apply | protégé | OK |
| startFitting | branche resize/orientation/ResizeObserver/MutationObserver | observers/listeners jamais retirés — voir finding | OK (mineur) |
| arrow l.278 | replanifie après rotation (+260 ms) | — | OK |

## (c) Findings

- **fit.js:277-295 | fuite ressource (cosmétique)** | `window.addEventListener('resize'|'orientationchange', …)`, `new ResizeObserver(schedule)` (l.281, observe body/arena/sides) et `new MutationObserver(schedule).observe(body,{childList,subtree:true})` (l.294) ne sont JAMAIS `remove`/`disconnect`. Vivent toute la vie de la page. Acceptable (shell unique, `#dicewrap` non recréé) ; si le shell était reconstruit, les anciens observers subsisteraient. `subtree:true` peut tirer souvent → amorti par le débounce rAF de `schedule`. Non bloquant.
- Concurrence (point 7) : tout passe par `apply()` via rAF (mono-thread) → aucun invariant cassé.
- Exceptions (point 1) : `apply()` peut lever (accès DOM), mais toujours appelé dans un callback rAF/listener où le moteur avale l'exception ; `pending` déjà remis à 0 → prochaine planif OK.

**Verdict : OK** (une fuite cosmétique d'observers non déconnectés).
