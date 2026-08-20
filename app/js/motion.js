/* ============================================================================
   motion.js — jouer sans jamais toucher l'ecran.

   Secouer  -> on lance le de.
   Pencher a droite / a gauche / vers l'avant -> on le pose dans cette colonne.

   ⛔ CE QUE LE VRAI TELEPHONE A APPRIS (2026-08-20)

   La premiere version lisait `accelerationIncludingGravity`. Sur l'appareil de
   l'admin : **pencher a droite posait a GAUCHE**, le centre etait inatteignable,
   et le halo restait allume. Ce n'etait pas un seuil mal regle, c'etait le
   CAPTEUR : le signe de ce vecteur n'est garanti par aucune specification, et le
   meme geste rend +x sur un appareil, -x sur un autre. Un modele bati dessus ne
   pouvait pas marcher partout.

   On lit donc `deviceorientation`, dont la convention est ecrite noir sur blanc :
     gamma = inclinaison laterale, POSITIF quand le cote DROIT descend ;
     beta  = inclinaison avant/arriere, 90 = telephone dresse, 0 = a plat.
   Plus aucun signe a deviner.

   Trois principes, sans quoi ce genre de commande est insupportable :
   1. UNE INTENTION, PAS UNE MESURE : un geste doit etre TENU (350 ms), ou franc.
   2. UN GESTE, UNE ACTION : tout est verrouille jusqu'au retour au repos.
   3. ON MONTRE CE QU'ON COMPREND : la colonne visee s'allume AVANT la pose —
      et s'eteint des que le jeu n'attend plus rien.
   ============================================================================ */

import { t } from './core/i18n.js';

const KEY = 'pd.motion';

/* Seuils : des degres d'orientation, et des g pour la secousse. */
const SHAKE_G = 1.9;          // au-dela, c'est un vrai coup de poignet
const REST_G = 1.25;          // en dessous, le telephone est calme
const TILT_SIDE = 20;         // gamma : pencher a droite ou a gauche
const FRONT_BETA = 42;        // beta : sous cette valeur, le telephone est couche vers l'avant
const REST_GAMMA = 12;        // fenetre laterale du repos
const REST_BETA = 52;         // au-dessus, le telephone est tenu normalement
const TILT_HOLD = 350;        // il faut tenir la pose : un a-coup ne compte pas
const REARM_MS = 700;         // temps mort apres une action

let on = false;
let armed = true;
let tiltSince = 0;
let tiltAim = -1;
let lastAction = 0;
let lastShake = 1;
let aimShown = -1;
let hooks = { canRoll: () => false, canPlace: () => false, roll() {}, place() {}, aim() {} };

export function motionEnabled() {
  return localStorage.getItem(KEY) === '1';
}

export function setMotionEnabled(value) {
  localStorage.setItem(KEY, value ? '1' : '0');
  on = !!value;
  if (!on) showAim(-1);
  return on;
}

export function motionAvailable() {
  return typeof window.DeviceOrientationEvent !== 'undefined'
      || typeof window.DeviceMotionEvent !== 'undefined';
}

function now() { return Date.now(); }

/** Le halo ne bouge que s'il change VRAIMENT : sinon on repeint soixante fois par seconde. */
function showAim(column) {
  if (aimShown === column) return;
  aimShown = column;
  hooks.aim(column);
}

function rest() {
  armed = true;
  tiltSince = 0;
  tiltAim = -1;
}

/**
 * Une mesure d'orientation. Exportee pour que les tests puissent la nourrir :
 * un vrai capteur ne se simule pas dans un navigateur de bureau.
 */
export function feed(sample) {
  if (!on) return;
  if (typeof sample.shake === 'number') lastShake = sample.shake;

  /* ── la secousse : lancer ─────────────────────────────────────────────── */
  if (lastShake >= SHAKE_G && armed && now() - lastAction > REARM_MS && hooks.canRoll()) {
    armed = false;
    lastAction = now();
    lastShake = 1;
    showAim(-1);
    hooks.roll();
    return;
  }

  if (!Number.isFinite(sample.gamma) || !Number.isFinite(sample.beta)) return;
  const gamma = sample.gamma;
  const beta = sample.beta;

  /* Le retour au calme REARME : sans lui, un telephone laisse penche
     declencherait une action a chaque mesure. */
  if (lastShake < REST_G && Math.abs(gamma) < REST_GAMMA && beta > REST_BETA) {
    rest();
  }

  /* ⚠️ Si le jeu n'attend plus de pose, le halo doit S'ETEINDRE. Sans ce
     nettoyage il restait allume sur la derniere colonne visee — vu a l'ecran. */
  if (!hooks.canPlace()) {
    showAim(-1);
    tiltSince = 0;
    tiltAim = -1;
    return;
  }

  /* ── l'inclinaison : poser ────────────────────────────────────────────── */
  let aim = -1;
  if (gamma >= TILT_SIDE) aim = 2;             // cote droit vers le bas -> colonne droite
  else if (gamma <= -TILT_SIDE) aim = 0;       // cote gauche vers le bas -> colonne gauche
  else if (beta <= FRONT_BETA) aim = 1;        // couche vers l'avant -> colonne du centre

  if (aim < 0) {
    tiltSince = 0;
    tiltAim = -1;
    showAim(-1);
    return;
  }

  if (aim !== tiltAim) {
    tiltAim = aim;
    tiltSince = now();
    showAim(aim);
    return;
  }
  showAim(aim);

  if (armed && now() - tiltSince >= TILT_HOLD && now() - lastAction > REARM_MS) {
    armed = false;
    lastAction = now();
    tiltSince = 0;
    showAim(-1);
    hooks.place(aim);
  }
}

/** L'orientation donne la direction ; la secousse se lit sur l'accelerometre. */
function onOrientation(ev) {
  if (ev.gamma === null && ev.beta === null) return;
  feed({ gamma: ev.gamma, beta: ev.beta });
}

function onMotion(ev) {
  const acc = ev.acceleration && ev.acceleration.x !== null ? ev.acceleration : null;
  const raw = acc || ev.accelerationIncludingGravity;
  if (!raw || raw.x === null) return;
  const norm = Math.sqrt(raw.x * raw.x + raw.y * raw.y + raw.z * raw.z) / 9.81;
  feed({ gamma: NaN, beta: NaN, shake: acc ? norm + 1 : norm });
}

/**
 * Branche les capteurs. `handlers` dit au module ce que le jeu autorise et
 * comment agir — le module ne connait ni l'etat de la partie ni le DOM.
 */
export function startMotion(handlers) {
  hooks = Object.assign(hooks, handlers || {});
  on = motionEnabled();
  window.__pdMotion = { feed, hooks, setMotionEnabled };
  let branche = false;
  if (typeof window.DeviceOrientationEvent !== 'undefined') {
    window.addEventListener('deviceorientation', onOrientation);
    branche = true;
  }
  if (typeof window.DeviceMotionEvent !== 'undefined') {
    window.addEventListener('devicemotion', onMotion);
    branche = true;
  }
  return branche;
}

export function motionLabel() {
  return t(motionEnabled() ? 'motion.on' : 'motion.off');
}
