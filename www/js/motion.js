/* ============================================================================
   motion.js — secouer le telephone lance le de.

   C'est tout ce que fait ce module, et c'est voulu.

   ⛔ CE QUI A ETE RETIRE, ET POURQUOI (2026-08-21)

   Il y avait ici une commande complete « jouer aux mouvements » : pencher a
   droite, a gauche ou vers l'avant posait le de dans la colonne correspondante,
   derriere un reglage a activer. Deux raisons de la supprimer :

   1. ELLE DEMANDAIT UNE PERMISSION D'ENTREE. Un geste utile est un geste qu'on
      decouvre en le faisant. Un geste cache derriere un interrupteur dans les
      reglages n'est jamais decouvert — donc jamais utilise.
   2. TROIS COLONNES ATTEIGNABLES EN PENCHANT, C'EST UNE MESURE, PAS UN JEU. Il
      fallait tenir la pose 350 ms, revenir au repos entre deux poses, et viser
      juste ; taper la colonne au doigt est plus rapide et ne rate jamais.

   La secousse, elle, reste : elle imite le gobelet, elle ne remplace aucune
   precision, et elle ne peut pas se declencher par accident pendant qu'on vise.
   Elle est donc TOUJOURS active, sans reglage.

   ⚠️ L'accelerometre ne garantit AUCUN signe pour les axes — le meme geste rend
   +x sur un appareil et -x sur un autre (verifie sur l'appareil de l'admin le
   2026-08-20, ou pencher a droite posait a gauche). On ne lit donc que la NORME
   du vecteur, qui elle ne depend d'aucune convention.
   ============================================================================ */

/* Des g. Au-dela de SHAKE_G c'est un vrai coup de poignet ; en dessous de
   REST_G le telephone est calme et le geste suivant peut compter. */
const SHAKE_G = 1.9;
const REST_G = 1.25;
const REARM_MS = 700;         // temps mort apres un lancer

let armed = true;
let lastAction = 0;
let hooks = { canRoll: () => false, roll() {} };

function now() { return Date.now(); }

/**
 * Une mesure d'acceleration, en g. Exportee pour que les tests puissent la
 * nourrir : un vrai capteur ne se simule pas dans un navigateur de bureau.
 */
export function feed(sample) {
  const g = sample && sample.shake;
  if (typeof g !== 'number') return;

  /* Le retour au calme REARME. Sans lui, une secousse prolongee lancerait a
     chaque mesure du capteur, soit soixante fois par seconde. */
  if (g < REST_G) armed = true;

  if (g >= SHAKE_G && armed && now() - lastAction > REARM_MS && hooks.canRoll()) {
    armed = false;
    lastAction = now();
    hooks.roll();
  }
}

function onMotion(ev) {
  /* `acceleration` exclut la gravite quand l'appareil sait la retirer ; sinon on
     retombe sur `accelerationIncludingGravity`, qui vaut deja 1 g au repos — le
     +1 aligne les deux echelles sur un meme seuil. */
  const acc = ev.acceleration && ev.acceleration.x !== null ? ev.acceleration : null;
  const raw = acc || ev.accelerationIncludingGravity;
  if (!raw || raw.x === null) return;
  const norme = Math.sqrt(raw.x * raw.x + raw.y * raw.y + raw.z * raw.z) / 9.81;
  feed({ shake: acc ? norme + 1 : norme });
}

/**
 * Branche l'accelerometre. `handlers` dit au module ce que le jeu autorise et
 * comment agir — le module ne connait ni l'etat de la partie ni le DOM.
 */
export function startMotion(handlers) {
  hooks = Object.assign(hooks, handlers || {});
  window.__pdMotion = { feed, hooks };
  if (typeof window.DeviceMotionEvent === 'undefined') return false;
  window.addEventListener('devicemotion', onMotion);
  return true;
}
