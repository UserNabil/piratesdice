/* ============================================================================
   motion.js — jouer sans jamais toucher l'ecran.

   Secouer  -> on lance le de.
   Pencher a droite / a gauche / vers l'avant -> on le pose dans cette colonne.

   Trois principes, sans quoi ce genre de commande est insupportable :

   1. UNE INTENTION, PAS UNE MESURE. Un telephone tenu en main bouge tout le
      temps. On n'agit donc pas sur un seuil franchi, mais sur un geste MAINTENU
      (l'inclinaison doit tenir 350 ms) ou franc (la secousse doit depasser
      largement le bruit de la main).
   2. UN GESTE, UNE ACTION. Apres chaque action, tout est verrouille jusqu'a ce
      que le telephone revienne au repos : sans cela une seule inclinaison
      poserait les trois des d'affilee.
   3. ON MONTRE CE QU'ON COMPREND. La colonne visee s'allume avant que le de ne
      tombe — sinon le joueur ne sait pas ce que le telephone a cru voir.

   Le capteur n'existe pas sur un poste de bureau : le module s'installe alors en
   silence et ne fait rien. Il est aussi pilotable a la main (`window.__pdMotion`)
   pour que les tests puissent rejouer un geste sans secouer une machine.
   ============================================================================ */

import { t } from './core/i18n.js';

const KEY = 'pd.motion';

/* Seuils. Regles en g (1 g = 9,81 m/s²) et en degres, pas en unites brutes. */
const SHAKE_G = 1.9;          // au-dela, c'est un vrai coup de poignet
const REST_G = 1.25;          // en dessous, le telephone est considere calme
const TILT_SIDE = 25;         // degres de roulis pour viser une colonne laterale
const TILT_FRONT = 52;        // degres de bascule vers l'avant pour viser le centre
const REST_ROLL = 14;         // fenetre de repos : le telephone tenu normalement
const REST_LEAN = 34;
const TILT_HOLD = 350;        // il faut tenir la pose : un a-coup ne compte pas
const REARM_MS = 700;         // temps mort apres une action

let on = false;
let armed = true;
let tiltSince = 0;
let tiltAim = -1;
let lastAction = 0;
let hooks = { canRoll: () => false, canPlace: () => false, roll() {}, place() {}, aim() {} };

export function motionEnabled() {
  return localStorage.getItem(KEY) === '1';
}

export function setMotionEnabled(value) {
  localStorage.setItem(KEY, value ? '1' : '0');
  on = !!value;
  return on;
}

/** Le capteur repond-il vraiment ? (un poste de bureau n'en a pas) */
export function motionAvailable() {
  return typeof window.DeviceMotionEvent !== 'undefined';
}

function now() { return Date.now(); }

function rest() {
  armed = true;
  tiltSince = 0;
  tiltAim = -1;
}

/**
 * Le roulis et la BASCULE, en degres.
 *
 * ⚠️ Le tangage brut ne veut rien dire ici : un telephone tenu droit affiche
 * deja 80 a 90 degres, si bien qu'un seuil naif le croyait « penche en avant »
 * en permanence — et le repos n'etait jamais atteint, donc plus rien ne se
 * declenchait apres la premiere secousse (mesure le 2026-08-20). On mesure donc
 * l'ecart A LA VERTICALE : 0 = tenu droit, 90 = a plat, ecran vers le ciel.
 */
function angles(g) {
  const roll = Math.atan2(g.x, Math.sqrt(g.y * g.y + g.z * g.z)) * 180 / Math.PI;
  const upright = Math.atan2(-g.y, Math.sqrt(g.x * g.x + g.z * g.z)) * 180 / Math.PI;
  return { roll, lean: 90 - upright };
}

/**
 * Traite une mesure. Exportee pour que les tests puissent la nourrir :
 * un vrai capteur ne se simule pas dans un navigateur de bureau.
 */
export function feed(sample) {
  if (!on) return;
  const g = sample.gravity;
  const shakeG = sample.shake;

  /* ── la secousse : lancer ─────────────────────────────────────────────── */
  if (shakeG >= SHAKE_G && armed && now() - lastAction > REARM_MS && hooks.canRoll()) {
    armed = false;
    lastAction = now();
    hooks.roll();
    return;
  }

  /* Le retour au calme REARME. Sans cela, un telephone laisse penche
     declencherait une action par mesure, soixante fois par seconde. */
  const at = angles(g);
  if (shakeG < REST_G && Math.abs(at.roll) < REST_ROLL && at.lean < REST_LEAN) {
    rest();
  }

  if (!hooks.canPlace()) return;

  /* ── l'inclinaison : poser ────────────────────────────────────────────── */
  const { roll, lean } = at;
  let aim = -1;
  if (roll >= TILT_SIDE) aim = 2;              // penche a droite -> colonne droite
  else if (roll <= -TILT_SIDE) aim = 0;        // penche a gauche -> colonne gauche
  else if (lean >= TILT_FRONT) aim = 1;        // bascule vers l'avant -> centre

  if (aim < 0) { tiltSince = 0; tiltAim = -1; hooks.aim(-1); return; }

  if (aim !== tiltAim) { tiltAim = aim; tiltSince = now(); hooks.aim(aim); return; }
  hooks.aim(aim);

  if (armed && now() - tiltSince >= TILT_HOLD && now() - lastAction > REARM_MS) {
    armed = false;
    lastAction = now();
    tiltSince = 0;
    hooks.aim(-1);
    hooks.place(aim);
  }
}

function onDeviceMotion(ev) {
  const g = ev.accelerationIncludingGravity;
  if (!g || g.x === null) return;
  const norm = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) / 9.81;
  const acc = ev.acceleration && ev.acceleration.x !== null ? ev.acceleration : null;
  const shake = acc
    ? Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) / 9.81 + 1
    : norm;
  feed({ gravity: { x: g.x, y: g.y, z: g.z }, shake });
}

/**
 * Branche les capteurs. `handlers` dit au module ce que le jeu autorise et
 * comment agir — le module ne connait ni l'etat de la partie ni le DOM.
 */
export function startMotion(handlers) {
  hooks = Object.assign(hooks, handlers || {});
  on = motionEnabled();
  window.__pdMotion = { feed, hooks, setMotionEnabled };
  if (!motionAvailable()) return false;
  window.addEventListener('devicemotion', onDeviceMotion);
  return true;
}

export function motionLabel() {
  return t(motionEnabled() ? 'motion.on' : 'motion.off');
}
