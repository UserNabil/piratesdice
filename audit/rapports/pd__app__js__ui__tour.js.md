# Audit — pd/app/js/ui/tour.js (182 lignes)

Fichier lu EN ENTIER. Lot annonce **27 fonctions** ; **~12 nommées** (dont fonctions imbriquées) + arrows (callbacks `atteint`/`domFait` des ÉTAPES, onclick, setTimeout). Écart dû au compteur auto.

## (a) Fonctions

| nom | ligne |
|---|---|
| (arrows) ETAPES `atteint`/`domFait` | 33, 38, 45, 46 |
| tutorielDejaVu() (export) | 49 |
| marquerVu() | 52 |
| lancerTutoriel(force) (export) | 56 |
| snap() | 92 |
| eclairer(sel) | 97 |
| poserBulle(sel) | 109 |
| montrer(idx) | 122 |
| replacer() | 131 |
| fini() | 137 |
| tic() | 146 |
| fermer() | 163 |
| surTouche(ev) | 170 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| tutorielDejaVu | drapeau `pd.tuto` lu | try/catch→false | OK |
| marquerVu | pose le drapeau | try/catch (stockage plein) | OK |
| lancerTutoriel | monte le tutoriel (partie d'entraînement) | garde double-lancement (`.pd-tour` déjà présent) ; gardes `UI.jouerSolo`/`pauseTimer` typés ; `innerHTML` STATIQUE (l.71, aucune interpolation) ; textes via `textContent` | OK |
| snap | instantané du jeu | try/catch→`{phase:null}` | OK |
| eclairer | positionne le trou de lumière | garde `!el`→cache le trou | OK |
| poserBulle | positionne la bulle | repli centre écran si `!el` ; positions bornées `Math.max/min` | OK |
| montrer | passe à l'étape idx | `i>=length`→`fini()` ; textes via `textContent` | OK |
| replacer | repositionne trou+bulle | gardes de bornes d'index | OK |
| fini | message final puis fermeture différée | `setTimeout(fermer, 2600)` ; `fermer` idempotent | OK |
| tic | boucle d'observation | garde `i<0` (attend 'playing') ; `ap.over`→fermer ; `atteint(avant,ap)` tolère undefined (snap renvoie {}); non enrobé try/catch — voir note | OK |
| fermer | teardown complet | `clearInterval` gardé, retire resize+keydown, `voile.remove()`, `pauseTimer(false)` ; idempotent | OK |
| surTouche | Échap ferme | preventDefault/stopPropagation + fermer | OK |

## (c) Findings

- **Aucune faille.** Teardown exemplaire : toutes les sorties (bouton passer l.86, Échap l.171, fin l.143→fermer, partie finie l.156→fermer) passent par `fermer()` qui annule l'intervalle (l.165), retire les deux listeners (resize l.166, keydown l.167) et retire le voile. `fermer()` est idempotent → l'appel doublé (Échap pendant les 2,6 s de `fini`) est sans effet néfaste.
- Note (point 1) : `tic()` (dans `setInterval`) n'est pas enrobé de try/catch, mais `snap()` l'est et renvoie `{phase:null}` en cas d'erreur ; les callbacks `atteint` comparent des champs éventuellement `undefined` sans jeter, et `eclairer`/`poserBulle` gardent l'existence de l'élément. Une exception resterait localisée au tick (avalée par le moteur, intervalle poursuit) ; après `fermer()` l'intervalle est annulé. Risque négligeable.
- Overlay `pointer-events:none` (documenté) → le tutoriel ne bloque jamais le jeu (point 5).

**Verdict : OK**
