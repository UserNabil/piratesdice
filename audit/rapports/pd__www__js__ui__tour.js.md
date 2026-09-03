# Rapport d'audit — pd/www/js/ui/tour.js

Chemin réel : `/Users/develop/piratesdice/www/js/ui/tour.js`
Lignes : 182. Lu en entier.

Rôle du fichier : tutoriel « coach » — au premier lancement, démarre une vraie
partie solo et guide trois gestes (lancer, poser, bonus) via un voile qui laisse
passer les clics (`pointer-events:none`). Sonde l'état du jeu à 350 ms et avance
quand la condition d'étape est atteinte.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| tutorielDejaVu() | 49 |
| marquerVu() | 52 |
| lancerTutoriel(force) | 56 |
| snap() [interne] | 92 |
| eclairer(sel) [interne] | 97 |
| poserBulle(sel) [interne] | 109 |
| montrer(idx) [interne] | 122 |
| replacer() [interne] | 131 |
| fini() [interne] | 137 |
| tic() [interne] | 146 |
| fermer() [interne] | 163 |
| surTouche(ev) [interne] | 170 |

Écart de comptage : le lot annonce 27 fonctions ; je compte 12 fonctions nommées
+ les arrows de `ETAPES` (`atteint`×3, `domFait`), l'`onclick` de « passer » et
le `setTimeout(fermer)`. Métrique auto gonflée par les `=>`. Aucune fonction
nommée manquante.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| tutorielDejaVu | Lit le drapeau `pd.tuto` en localStorage. | try/catch → false si stockage indispo | OK |
| marquerVu | Écrit le drapeau. | try/catch → silence si plein | OK |
| lancerTutoriel | Monte le voile, lance la partie solo, arme le sondage. | double-lancement gardé (`.pd-tour`) ; `UI.jouerSolo`/`pauseTimer` gardés par `typeof` ; innerHTML STATIQUE (pas d'interpolation) ; teardown complet dans `fermer` | OK |
| snap | Lit l'instantané du jeu. | try/catch → `{phase:null}` (point 1 OK) | OK |
| eclairer | Positionne le « trou » sur la cible. | garde `!el` → cache le trou ; lectures DOM sûres | OK |
| poserBulle | Positionne la bulle, cible absente → centre écran. | repli sur rect central si `!el` ; `Math.max/min` bornent | OK |
| montrer | Passe à l'étape idx, ou termine. | garde `i >= ETAPES.length` → `fini()` | OK |
| replacer | Repositionne trou+bulle sur suivi de mise en page. | gardes de bornes `i<0 / >=len` | OK |
| fini | Écran de fin, auto-fermeture après 2,6 s. | `setTimeout(fermer)` ; fermer idempotent | OK |
| tic | Sonde l'état, avance l'étape ou ferme si partie finie. | non enveloppé mais appels sûrs ; `atteint` tolère snapshots dégradés (undefined) sans jeter ; l'interval survit à un throw | OK |
| fermer | Relance la pendule, coupe l'interval, retire écouteurs et voile. | libération complète (point 6 OK) ; idempotent | OK |
| surTouche | Echap ferme le tutoriel. | `preventDefault/stopPropagation` + fermer | OK |

## c) Findings détaillés

Aucune faille détectée.

Notes non bloquantes :
- Grille point 6 : `fermer()` couvre tous les chemins de sortie (bouton passer,
  Echap, partie finie, auto-fin) et libère interval, écouteurs `resize`/`keydown`
  et le nœud voile. `fermer` est idempotent (garde `if (minuterie)`, `remove()`
  no-op), donc un double appel (auto-fin après Echap) est sans effet.
- Grille point 1/3 : `tic` n'est pas enveloppé de try/catch, mais `snap()` l'est,
  et les fonctions `atteint` de `ETAPES` comparent des champs qui, absents
  (`{phase:null}`), donnent `undefined` sans jeter. Un `setInterval` poursuit de
  toute façon après un throw isolé — pas de blocage.
- Grille point 4 : le HTML du voile (`voile.innerHTML`) est une structure
  statique ; tous les textes dynamiques (`t('tour.*')`) sont posés via
  `textContent`. Pas de surface d'injection.
- Si `UI.jouerSolo` manque (vieille coque), la partie ne démarre pas, `phase` ne
  passe jamais à `playing`, et le voile reste sur l'intro jusqu'à Echap/passer —
  jamais un blocage dur (le jeu dessous reste jouable, pointer-events:none).

## Statut fichier : OK
