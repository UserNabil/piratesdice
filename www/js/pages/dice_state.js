/* ============================================================================
   pages/dice_state.js — the one copy of the dice game's state.

   Split out for the same reason as classes_state.js / entity_state.js: the shell
   (dice.js) and the match screen (dice_match.js) both need it, and importing one
   from the other would make a cycle. `UI` is the small registry the shell fills
   so the match screen can hand control back without importing it.

   ⚠ SINGLE INSTANCE — import it through './dice_state.js' everywhere, never with
   a query string: two URLs would be two modules, hence two S objects.
   ============================================================================ */

import { $ } from '../core/dom.js';

export const ASSETS = '/dice/';

/* Le catalogue en base nomme encore ses icones `bonus1.png` (l'ancien jeu). On
   traduit ICI plutot que de reecrire la base : le nom d'un objet de gameplay et
   le fichier qui le dessine n'ont pas a etre la meme chose. */
const BONUS_ART = {
  B001: 'bonus_reroll.png',
  B002: 'bonus_clear_own.png',
  B003: 'bonus_blast_enemy.png',
};

export function bonusArt(identify) {
  return ASSETS + 'img/' + (BONUS_ART[identify] || 'bonus_reroll.png');
}

/* ── LES EFFETS SONT PRECHARGES A L'OUVERTURE, PUIS JOUES DEPUIS LA MEMOIRE ──
   Mesure du 2026-08-19 : un APNG rejoue avec la MEME url ne repart PAS de sa
   premiere image (il reste sur la derniere) — d'ou le `?t=` historique. Mais
   celui-ci RETELECHARGEAIT la planche a chaque lecture (2,8 Mo par explosion) et
   l'effet n'apparaissait qu'apres ~250 ms : c'est ce qui faisait des animations
   « bizarres » les premieres fois. Un blob garde en memoire donne une url NEUVE
   a chaque lecture — donc l'animation repart — SANS la moindre requete. */
const FX_FILES = ['fx_burst.png', 'fx_place.png', 'fx_roll.png', 'fx_win.png'];

const STILL_FILES = [
  'bg.jpg', 'die_unknown.png', 'cup.png', 'cup_active.png', 'brand_mark.png',
  'avatar.png', 'avatar_player.png', 'icon_coin.png', 'icon_anchor.png',
  'seal_victory.png', 'seal_defeat.png', 'seal_draw.png', 'ornament_stake.png',
  'bonus_reroll.png', 'bonus_clear_own.png', 'bonus_blast_enemy.png',
  'die_1.png', 'die_2.png', 'die_3.png', 'die_4.png', 'die_5.png', 'die_6.png',
  'die_1_hot.png', 'die_2_hot.png', 'die_3_hot.png', 'die_4_hot.png',
  'die_5_hot.png', 'die_6_hot.png',
  'avatar_ai_1.png', 'avatar_ai_2.png', 'avatar_ai_3.png', 'avatar_ai_4.png',
];

const FX_BLOBS = new Map();
let warmed = false;

/** Appele a l'ouverture de la modale : rien n'attend, mais tout est la ensuite. */
export function preloadAssets() {
  if (warmed) return;
  warmed = true;
  STILL_FILES.forEach((file) => { const img = new Image(); img.src = ASSETS + 'img/' + file; });
  FX_FILES.forEach((file) => {
    fetch(ASSETS + 'img/' + file)
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => { if (blob) FX_BLOBS.set(file, blob); })
      .catch(() => { /* pas de blob : l'url horodatee reste le repli */ });
  });
}

/** Une url NEUVE a chaque appel : c'est ce qui fait repartir l'APNG de sa 1re image. */
export function fxUrl(file, lifeMs) {
  const blob = FX_BLOBS.get(file);
  if (!blob) return ASSETS + 'img/' + file + '?t=' + Date.now();
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), lifeMs || 6000);
  return url;
}

export const S = {
  net: null,
  open: false,
  built: false,
  seat: -1,
  state: null,
  me: null,
  inventory: [],
  shop: [],
  rules: { maxBonusPerMatch: 3, winReward: 10 },
  panel: null,
  queued: false,
  visualLock: 0,
  rolling: false,
  awaySaid: false,
  wasNativeFull: false,
  sfx: null,
};

/** Filled by dice.js at boot: { showMenu, renderWallet }. */
export const UI = {};

export function screen(name) {
  ['connect', 'menu', 'game'].forEach((s) => {
    const el = $('#dc-screen-' + s);
    if (el) el.classList.toggle('on', s === name);
  });
}

export function boardOf(seat) {
  const game = $('#dc-screen-game');
  return game ? game.querySelector(`.dc-board[data-seat="${seat}"]`) : null;
}

/** True when the player may act: their turn, match running, no animation pending. */
export function myTurn() {
  return !!(S.state && S.state.phase === 'playing' && S.state.turn === S.seat && !S.visualLock);
}
