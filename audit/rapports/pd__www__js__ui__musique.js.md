# Rapport d'audit — pd/www/js/ui/musique.js

Chemin réel : `/Users/develop/piratesdice/www/js/ui/musique.js`
Lignes : 387. Lu en entier (2 tranches de 200).

Rôle du fichier : la classe `Musique` gère la musique de fond en boucle sans
trou (relais entre deux lecteurs `<audio>` car `loop=true` hoquette en
WKWebView), les fondus enchaînés, la mise en veille quand l'app passe derrière,
et le curseur de volume.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| constructor(base) | 81 |
| jouer(scene) | 116 |
| ouvrir(piste) | 146 |
| armerLeRelais() | 164 |
| desarmerLeRelais() | 189 |
| passerLeRelais() | 195 |
| essayerDeJouer() | 232 |
| niveauReel() | 254 |
| appliquerNiveau(secondes, depuis) | 268 |
| echelonner(element, depart, arrivee, secondes, fin) | 284 |
| eteindre(secondes) | 302 |
| set volume(facteur) | 329 |
| get volume() | 350 |
| suspendre() | 352 |
| reprendre() | 354 |
| arreter(secondes) | 372 |
| set muted(valeur) | 379 |
| get muted() | 386 |

Écart de comptage : le lot annonce 43 fonctions ; je compte 18 méthodes nommées.
Le reste (≈25) sont des callbacks fléchés anonymes : handler `visibilitychange`,
`guetter` (interval), `ended`, `tic` (interval de `echelonner`), les `setTimeout`
de `passerLeRelais`/`eteindre`, les `.catch` des `play()`, `reprendre` interne de
`essayerDeJouer`, etc. Métrique auto fortement gonflée par les `=>`. Aucune
méthode nommée manquante.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| constructor | Initialise l'état, pose le handler `visibilitychange`. | handler jamais retiré (pas de dispose) — inoffensif car instance unique via `build()` gardé par `S.built` (dice.js:246) | OK |
| jouer | Démarre la musique d'une scène, croise avec la sortante. | `!choix` garde scène inconnue ; try/catch → `audio=null` ; play géré | OK |
| ouvrir | Crée un `<audio>` prêt (sans `loop`). | `new Audio(url)` ne jette pas ; appelé sous try dans jouer/passerLeRelais | OK |
| armerLeRelais | Pose interval de guet + écoute `ended` (once). | `suivant.load()` sous try/catch ; guards `this.audio===audio` contre callbacks obsolètes | OK |
| desarmerLeRelais | Coupe interval `horloge` et timer `minuteur`. | libération correcte (point 6) | OK |
| passerLeRelais | Bascule sur le second lecteur, l'ancien finit en fondu. | corps risqué sous try/catch ; MAIS voir Finding 1 : sur le chemin SANS Web Audio, les deux `echelonner` partagent `this.pas` | FAILLE |
| essayerDeJouer | Relance `play()`, retente au 1er geste (une fois). | `.catch` sur les deux `play()` ; écouteur `pointerdown` retiré dans le handler | OK |
| niveauReel | Volume borné [0,1] pour `<audio>`. | `Math.min/max` | OK |
| appliquerNiveau | Pose le niveau via gain (Web Audio) ou echelonner (repli). | `audio.volume=` sous try/catch ; gardes | OK |
| echelonner | Fondu pas-à-pas (repli sans Web Audio) via un interval. | `element.volume=` sous try/catch ; `this.pas` = **un seul** slot d'interval → collision si deux fondus simultanés (Finding 1) | FAILLE (cause) |
| eteindre | Sortie en fondu et lâcher de la piste. | desarme le relais ; pause `suivant` sous try ; `finir` a un try/catch interne ; un seul echelonner à la fois ici | OK |
| set volume | Curseur de volume, appliqué à chaud. | `Number(facteur)` + `isFinite && >0 ? f : 0` ; garde `enFondu` | OK |
| get volume | Renvoie le niveau. | trivial | OK |
| suspendre | Pause la piste. | try/catch | OK |
| reprendre | Reprend depuis le silence, réveille le bus. | gardes muette/dehors/niveau/audio | OK |
| arreter | Arrêt définitif en fondu. | défaut `FONDU.coupe` | OK |
| set muted | Interrupteur global du son. | applique niveau + suspend/reprend | OK |
| get muted | Renvoie l'état muet. | trivial | OK |

## c) Findings détaillés

### Finding 1 — Crossfade du relais cassé sur le chemin SANS Web Audio (`this.pas` partagé par deux fondus simultanés)
- Emplacement : `passerLeRelais` `musique.js:211` et `:218` ; `echelonner`
  `musique.js:284-285`.
- Gravité : cosmétique (musique muette après la première boucle, uniquement sur
  navigateur sans Web Audio ; aucun impact sur le jeu).
- Extrait (`passerLeRelais`, chemin de repli sans gain Web Audio) :
```js
neuf.volume = gain ? 1 : 0;
...
if (gain) fondre(gain, 0, cible, piste.fondu);
else this.echelonner(neuf, 0, cible, piste.fondu);      // ligne 211 : lance tic1, this.pas = tic1
...
if (ancienGain) fondre(ancienGain, cible, 0, piste.fondu);
else this.echelonner(ancien, ancien.volume, 0, piste.fondu); // ligne 218
```
et `echelonner` (début) :
```js
echelonner(element, depart, arrivee, secondes, fin) {
  if (this.pas) { clearInterval(this.pas); this.pas = null; }   // ligne 285 : tue tic1
  ...
  this.pas = tic;
}
```
- Pourquoi c'est un risque : quand le bus Web Audio est indisponible
  (`brancherElement` renvoie `null`, donc `gain === null` et `ancienGain ===
  null`), le relais lance DEUX fondus simultanés via `echelonner` — un pour le
  nouveau lecteur (montée 0→cible), un pour l'ancien (descente→0). Or
  `echelonner` n'a qu'un seul emplacement d'interval (`this.pas`) et commence par
  tuer l'interval précédent. Le second appel (ancien, ligne 218) annule donc la
  montée du nouveau lecteur (ligne 211) : `neuf.volume` reste figé à ~0 (sa
  valeur initiale), et la musique devient muette à chaque relais de boucle sur
  ce chemin. Grille point 7 (état partagé : deux « appels » concurrents cassent
  un invariant — ici deux fondus qui se disputent le même timer). Sur le chemin
  Web Audio normal (iOS et navigateurs modernes), les deux fondus passent par
  `fondre` (AudioParam indépendants) et le défaut ne se produit pas — d'où la
  gravité cosmétique et la faible surface.

## Notes non bloquantes

- Le handler `visibilitychange` posé dans le constructeur (`musique.js:104`)
  n'est jamais retiré et aucune méthode de destruction n'existe. Inoffensif en
  l'état : `Musique` est instancié une seule fois, dans `build()` protégé par
  `if (S.built) return` (dice.js). Deviendrait une fuite (et des instances
  fantômes appelant `dormir()`) si l'objet était recréé.
- Toutes les promesses `play()` ont leur `.catch` (point 2 OK) ; les callbacks
  différés risqués (`guetter`, `tic`, `setTimeout` de nettoyage) enveloppent
  leurs accès sensibles (point 3 OK).

## Statut fichier : FAILLES(1) [cosmétique]
