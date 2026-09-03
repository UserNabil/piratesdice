# Audit — pd/app/js/motion.js (81 lignes)

Fichier lu EN ENTIER. Lot annonce **5 fonctions** ; **4 nommées** + les 2 arrows par défaut de `hooks` (l.37) → cohérent.

## (a) Fonctions

| nom | ligne |
|---|---|
| now() | 39 |
| feed(sample) (export) | 45 |
| onMotion(ev) | 60 |
| startMotion(handlers) (export) | 75 |
| (arrows par défaut) `canRoll:()=>false`, `roll(){}` | 37 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| now | horloge (Date.now) | pur | OK |
| feed | décide si une secousse lance le dé | valide `typeof g!=='number'`→return ; garde `armed`+`REARM_MS`+`canRoll()` ; `hooks.roll()` peut jeter mais dans un listener DOM (avalé) ; `armed=false` posé avant `roll()` → réarmé au retour au calme | OK |
| onMotion | lit l'accéléromètre, calcule la norme | gardes `!raw`/`raw.x===null` ; norme = valeur absolue, indépendante des signes d'axes | OK |
| startMotion | branche `devicemotion` | garde `DeviceMotionEvent` indéfini→false ; expose `window.__pdMotion` (debug) ; listener jamais retiré — voir finding | OK (mineur) |

## (c) Findings

- **motion.js:79 | fuite ressource (cosmétique)** | `window.addEventListener('devicemotion', onMotion)` n'est jamais retiré (pas de `stopMotion`). Vit toute la vie de la page ; un seul branchement au démarrage → sans conséquence pratique. Note : `window.__pdMotion = { feed, hooks }` (l.77) est un point d'entrée global de test/debug qui laisse déclencher `feed` depuis la console — sans portée de sécurité (déclenche seulement un lancer de dé, déjà borné par `canRoll()`).
- Exceptions (point 1) : si `hooks.roll()` jette, l'exception remonte dans le handler `devicemotion` → avalée par le moteur ; `armed`/`lastAction` déjà mis à jour, l'état reste cohérent.
- Concurrence (point 7) : `armed`/`lastAction` en mono-thread → pas d'invariant cassé.

**Verdict : OK**
