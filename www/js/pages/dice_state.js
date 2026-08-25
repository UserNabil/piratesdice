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
  /* Ces deux-la empruntent le dessin du TRAIT qui les offre : la longue-vue de
     Ching Shih et la benediction de Grace O'Malley. C'est exactement ce que
     cette table permet — le nom en base et le fichier qui le dessine n'ont pas
     a etre la meme chose, et un joueur qui a vu le trait reconnait l'effet. */
  B004: 'trait_ching.png',
  B005: 'trait_omalley.png',
  /* Le gel est aussi le trait de Barbe-Noire : meme dessin des deux cotes, pour
     qu'un joueur qui a vu le capitaine reconnaisse l'effet en boutique. */
  B006: 'bonus_freeze.png',
};

/**
 * Les des d'un siege : ceux d'origine, ou la parure qu'il porte.
 *
 * ⚠️ LA PARURE VIENT DE L'ETAT, PAS DU CLIENT LOCAL. Chacun verrait sinon ses
 * propres des des deux cotes, et une parure achetee ne se montrerait a personne —
 * ce qui lui retire tout son interet.
 */
/**
 * L'arrondi PEINT sur les dés de chaque parure, en % du côté — mesuré, pas estimé.
 *
 * ⚠️ LES JEUX LIVRÉS N'ONT PAS TOUS LE MÊME ARRONDI. Nos dés d'origine font 27 %,
 * l'or et le rubis 25, le pirate 21, l'arabe et le dragon 16. Un logement calé
 * une fois pour toutes sur 27 % laisse quatre coins vides bien visibles autour
 * d'un dé à 16 — c'est exactement le défaut que l'admin avait signalé sur les dés
 * d'origine, et qui reviendrait par la porte des parures.
 *
 * Arrondir les dessins pour les aligner serait pire : on abîmerait un art livré
 * fini. C'est le logement qui s'adapte.
 */
const ARRONDI = { S002: 30.7, S003: 25.1, S004: 25.1, S005: 21.3, S006: 31.4, S007: 15.9 };
const ARRONDI_ORIGINE = 27;

/**
 * La part de la toile qu'occupe le CORPS du de, parure par parure.
 *
 * ⚠️ CE N'ETAIT PAS UNE CONSTANTE, ET LA TRAITER COMME TELLE FAUSSAIT LE
 * LOGEMENT. Le calcul supposait 239 px sur 256 pour tout le monde — vrai a un
 * pixel pres pour nos des et pour l'or, faux de 21 px pour l'arabe (S006), dont
 * le corps ne fait que 225. Le logement etait donc arrondi pour un de plus gros
 * que celui qu'on y pose : les coins ne se suivaient pas. Mesure du 2026-08-23
 * sur les pixels VRAIMENT opaques (alpha >= 200) — la boite alpha brute inclut
 * un halo diffus et asymetrique qui ment de dix pixels.
 */
const CORPS = { S002: 0.895, S003: 0.926, S004: 0.928, S005: 0.905, S006: 0.910, S007: 0.920 };
const CORPS_ORIGINE = 0.923;

/**
 * L'arrondi du LOGEMENT, en fraction de la case.
 *
 * Le de n'occupe qu'une part de sa toile : il reste une marge de part et
 * d'autre. Pour que les deux bords restent paralleles :
 *     rayon du logement = rayon du de x part du corps + demi-marge
 */
export function arrondiDeCase(skin) {
  const pc = (skin && ARRONDI[skin]) || ARRONDI_ORIGINE;
  const corps = (skin && CORPS[skin]) || CORPS_ORIGINE;
  return (pc / 100) * corps + (1 - corps) / 2;
}

export function skinOf(seat) {
  const p = S.state && S.state.players ? S.state.players[seat] : null;
  const s = p && p.skin;
  return typeof s === 'string' && /^[A-Z0-9]{1,8}$/.test(s) ? s : null;
}

/** Le dossier d'images d'une parure, ou celui d'origine. */
export function dieArt(skin) {
  return skin ? (ASSETS + 'img/skins/' + skin + '/') : (ASSETS + 'img/');
}

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
  'icon_coin.png', 'icon_anchor.png', 'icon_bell.png', 'icon_settings.png',
  'icon_shop.png', 'icon_ranking.png', 'icon_rules.png', 'icon_duel.png',
  'seal_victory.png', 'seal_defeat.png', 'seal_draw.png', 'ornament_stake.png',
  'bonus_reroll.png', 'bonus_clear_own.png', 'bonus_blast_enemy.png',
  'bonus_freeze.png', 'fx_freeze.png', 'icon_loader.png',
  'icon_bag.png', 'icon_versus.png', 'icon_leave.png',
  'menu_ai.png', 'menu_versus.png', 'menu_friend.png',
  'icon_back.png', 'icon_table.png', 'icon_join.png',
  'rank_1.png', 'rank_2.png', 'rank_3.png',
  'mood_laugh.png', 'mood_angry.png', 'mood_shocked.png',
  'mood_good.png', 'mood_think.png',
  'die_1.png', 'die_2.png', 'die_3.png', 'die_4.png', 'die_5.png', 'die_6.png',
  'die_1_hot.png', 'die_2_hot.png', 'die_3_hot.png', 'die_4_hot.png',
  'die_5_hot.png', 'die_6_hot.png',
  'cap_read.png', 'cap_teach.png', 'cap_ching.png', 'cap_omalley.png', 'cap_jack.png',
  'trait_read.png', 'trait_teach.png', 'trait_ching.png', 'trait_omalley.png', 'trait_jack.png',
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
