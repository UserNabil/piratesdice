# Audit — pd/app/js/ui/musique.js (387 lignes)

Fichier lu EN ENTIER (2 tranches). Lot annonce **43 fonctions** ; **~19 méthodes** de la classe `Musique` + arrows (visibilitychange, guetter, setTimeout/setInterval, catch). Écart dû au compteur auto.

## (a) Fonctions (méthodes de `Musique`)

| nom | ligne |
|---|---|
| constructor(base) | 81 |
| (arrow) visibilitychange | 104 |
| jouer(scene) | 116 |
| ouvrir(piste) | 146 |
| armerLeRelais() | 164 |
| (arrow) guetter | 169 |
| desarmerLeRelais() | 189 |
| passerLeRelais() | 195 |
| essayerDeJouer() | 232 |
| niveauReel() | 254 |
| appliquerNiveau(secondes, depuis) | 268 |
| echelonner(element, depart, arrivee, secondes, fin) | 284 |
| eteindre(secondes) | 302 |
| set volume(facteur) | 329 |
| enFondu() | 346 |
| get volume() | 350 |
| suspendre() | 352 |
| reprendre() | 354 |
| arreter(secondes) | 372 |
| set muted(valeur) / get muted() | 379 / 386 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| constructor | initialise l'état + listener visibilitychange | listener jamais retiré (par instance) — voir finding | OK (mineur) |
| jouer | joue la musique d'une scène | idempotent (même scène) ; garde `!choix` ; try/catch→`audio=null` ; `eteindre(croise)` croise l'ancienne | OK |
| ouvrir | crée un `<audio>` prêt | `loop=false` (le relais gère la boucle) | OK |
| armerLeRelais | guette le point de boucle | `desarmerLeRelais()` d'abord ; `guetter` sort si `this.audio!==audio` (garde le stale) ; garde `!duree/!isFinite` ; `ended` `{once:true}` + garde | OK |
| desarmerLeRelais | annule horloge + minuteur | gardes, remet à null | OK |
| passerLeRelais | bascule sur le lecteur suivant | try/catch → garde l'ancien ; `play().catch` géré ; setTimeout de nettoyage débranche l'ancien | OK |
| essayerDeJouer | joue, retente au 1er geste | `play().catch` ; `enAttenteDeGeste` évite les doubles listeners ; retire le listener après usage | OK |
| niveauReel | volume borné pour `<audio>` | `Math.min(1,Math.max(0,…))` | OK |
| appliquerNiveau | pose le niveau (gain ou repli) | gardes ; via `fondre`/`niveauElement` (ne jettent pas) | OK |
| echelonner | fondu pas-à-pas (sans WebAudio) | `clearInterval(this.pas)` avant recréation ; `volume` clampé dans try/catch ; s'auto-termine à N — voir note | OK |
| eteindre | sort la piste en fondu, la lâche | `desarmerLeRelais` ; pause du `suivant` ; setTimeout de nettoyage `debrancherElement` | OK |
| set volume | curseur à chaud | `Number.isFinite`→0 sinon ; ne ranime qu'en venant de 0 ; respecte le fondu en cours | OK |
| enFondu / get volume / get muted | lecteurs d'état | purs | OK |
| suspendre | pause | try/catch | OK |
| reprendre | reprise en fondu + réveil du bus | gardes muette/dehors/niveau/audio | OK |
| arreter | arrêt définitif en fondu | `eteindre` + `scene=null` | OK |
| set muted | coupe/rend le son | applique niveau + suspend/reprend | OK |

## (c) Findings

- **musique.js:104-108 | fuite ressource (mineure, par instance)** | le listener `document.addEventListener('visibilitychange', …)` du constructeur n'est jamais retiré : pas de `destroy()`. Sans conséquence si `Musique` est un singleton pour la vie de l'app ; si plusieurs instances étaient créées, les listeners s'accumuleraient (chacun capture son `this`).
- **musique.js:284-296 | cosmétique** | `this.pas` (intervalle de `echelonner`, chemin de repli sans WebAudio) n'est annulé qu'au début d'un nouvel `echelonner` et à sa propre fin (`i>=N`) ; `jouer`/`arreter`/`eteindre` sur le chemin GAIN ne l'annulent pas. L'intervalle s'auto-termine (borné par N pas) → au pire quelques rampes de volume résiduelles sur un `<audio>` déjà lâché. Chemin de repli rare (pas de Web Audio ; sur iOS `volume` est de toute façon ignoré). Non bloquant.
- Async (point 2) : tous les `play()` renvoyant une promesse ont un `.catch` (l.215, 236, 245). Timers (horloge/minuteur/pas) gérés et annulés. Gardes anti-stale (`this.audio===audio`) protègent les invariants malgré l'entrelacement des minuteurs.

**Verdict : OK** (deux fuites/résidus mineurs sans impact de jeu).
