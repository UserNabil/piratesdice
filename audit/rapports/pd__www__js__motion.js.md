# Audit — pd/www/js/motion.js (81 lignes)

Fichier lu en entier. Lot annonce **5 fonctions**, **6 trouvées**. Écart +1 : le lot n'a probablement pas compté la méthode vide `roll(){}` (ou l'arrow `canRoll`) de l'objet `hooks` par défaut.

## (a) Fonctions

| nom | ligne |
|---|---|
| (arrow) `canRoll: () => false` | 37 |
| (méthode) `roll() {}` | 37 |
| now | 39 |
| feed | 45 |
| onMotion | 60 |
| startMotion | 75 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| canRoll (défaut) | autorisation par défaut = false | — | OK |
| roll (défaut) | action par défaut = no-op | — | OK |
| now | `Date.now()` | — | OK |
| feed | reçoit une mesure en g, arme/déclenche le lancer | valide `typeof g !== 'number'`→return ; si un `hooks.canRoll/roll` fourni lève, l'exception remonte à `onMotion` (avalée par le navigateur) | OK |
| onMotion | lit l'accéléromètre, calcule la norme, appelle feed | gardes `!raw`/`raw.x===null` ; ne lit que la NORME (aucune convention de signe) | OK |
| startMotion | branche `devicemotion`, expose `window.__pdMotion` | voir findings (exposition globale ; pas de requestPermission iOS ; écouteur non retiré) | OK (notes) |

## (c) Findings

- **motion.js:78-79 (startMotion) | cosmétique / fonctionnel** | `if (typeof window.DeviceMotionEvent === 'undefined') return false; window.addEventListener('devicemotion', onMotion);` | Aucun appel à `DeviceMotionEvent.requestPermission()` (requis sur iOS 13+, sur geste utilisateur). Sur iOS l'événement `devicemotion` ne se déclenchera jamais sans cette demande → la secousse est silencieusement inactive sur iPhone. Pas un crash ; comportement produit. À noter.
- **motion.js:77 | cosmétique** | `window.__pdMotion = { feed, hooks };` | Expose `feed`/`hooks` en global (utile aux tests, cf. commentaire) — surface debug, sans impact fonctionnel.
- **motion.js:79 | cosmétique** | écouteur `devicemotion` jamais retiré | vie de la page ; module de démarrage unique. Non bloquant.
- Concurrence : état module `armed`/`lastAction` mono-thread → invariant du ré-armement (l.51) sûr. OK.

**Verdict : OK**
