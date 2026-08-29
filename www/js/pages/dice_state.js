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
  /* Les suivants empruntent le dessin du TRAIT qui les offre. C'est exactement
     ce que cette table permet — le nom en base et le fichier qui le dessine n'ont
     pas a etre la meme chose — et un joueur qui a vu le capitaine reconnait
     l'effet en boutique.

     ⚠️ LA LONGUE-VUE A CHANGE DE MAIN, DONC DE FICHIER. Elle etait le trait de
     Ching Shih (`trait_ching.png`) ; elle est passee a la Lionne Sanglante, qui
     la tient sur son portrait. Le dessin, lui, n'a pas bouge : il a ete recopie
     sous le nom de son nouveau capitaine, et `trait_ching.png` porte desormais
     le canon qui rase une colonne. Pointer encore ici sur `trait_ching` aurait
     donne un canon pour illustrer un regard. */
  B004: 'trait_lionne.png',
  B005: 'trait_omalley.png',
  /* Le gel de COLONNE est le trait de Barbe-Noire. Le dessin d'origine — des
     chaines et de la glace — vaut toujours : ce qui a change, c'est ce qu'il
     gele, pas la maniere dont il le gele. */
  B006: 'bonus_freeze.png',
  B007: 'trait_morgan.png',
  B008: 'trait_bonny.png',
  B009: 'trait_bart.png',
  B010: 'trait_ching.png',
  B011: 'trait_levasseur.png',
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
const ARRONDI = { S002: 30.7, S003: 25.1, S004: 25.1, S005: 21.3, S006: 31.4, S007: 15.9,
                  S008: 30.9, S009: 27.2, S010: 34.7 };
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
/* ⚠️ L'OR ETAIT PLUS PETIT QUE LES AUTRES, ET CA SE VOYAIT DANS SON LOGEMENT.
   Son corps n'occupait que 0,891 x 0,863 de sa toile quand les autres jeux en
   remplissent 0,93 : pose dans la meme case, il laissait un vide tout autour —
   « les des dores sont plus petits, il reste du vide dans leurs slots ». Ce
   n'etait pas un reglage a corriger mais les DOUZE IMAGES : elles ont ete
   remises a l'echelle sur leur corps opaque et recentrees dessus (le halo,
   asymetrique, faisait deriver le centrage). Mesure apres : 0,926. */
/* Les trois derniers sont arrives normalises : leur corps a ete remis a
   l'echelle des autres (0,926) avant d'entrer dans le depot. */
const CORPS = { S002: 0.926, S003: 0.926, S004: 0.928, S005: 0.905, S006: 0.910, S007: 0.920,
                S008: 0.922, S009: 0.926, S010: 0.926 };
const CORPS_ORIGINE = 0.923;

/**
 * L'arrondi du LOGEMENT, en fraction de la case.
 *
 * Le de n'occupe qu'une part de sa toile : il reste une marge de part et
 * d'autre. Pour que les deux bords restent paralleles :
 *     rayon du logement = rayon du de x part du corps + demi-marge
 */
export function arrondiDeCase(skin) {
  /* ⚠️ LA GRAVURE NE CHANGE PAS LA GEOMETRIE DU DE. `S006_M001` est le meme
     corps et le meme arrondi que `S006` : sans cette coupe, la combinaison
     retombait sur les valeurs par defaut et le logement cessait de suivre les
     coins — exactement le defaut qu'on avait corrige pour l'or. */
  const nu = typeof skin === 'string' ? skin.split('_')[0] : null;
  const jeu = nu === 'D000' ? null : nu;
  const pc = (jeu && ARRONDI[jeu]) || ARRONDI_ORIGINE;
  const corps = (jeu && CORPS[jeu]) || CORPS_ORIGINE;
  return (pc / 100) * corps + (1 - corps) / 2;
}

/* Les jeux de des dont les motifs ont ete GRAVES (outils/motifs.py). C'est le
   client qui porte les images, c'est donc lui qui sait quelles combinaisons
   existent : un jeu retire du catalogue garde sa parure, sans gravure. */
const GRAVES = ['D000', 'S002', 'S006', 'S008', 'S009', 'S010'];
const JEU_NU = 'D000';

const identifiant = (s) => (typeof s === 'string' && /^[A-Z0-9]{1,8}$/.test(s) ? s : null);

/**
 * Le dossier d'images du siege : la parure, et le motif s'il y en a un.
 *
 * ⚠️ LE MOTIF N'EST PAS UNE COUCHE POSEE A L'ECRAN, C'EST UNE AUTRE IMAGE. Le
 * dragon sur les des d'or et le dragon sur ceux du sultan sont deux gravures
 * differentes, faites a l'avance. Superposer deux images au rendu aurait
 * demande de tenir deux boites alignees au pixel pendant que le de tourne et
 * rebondit — le genre de promesse que ce depot a deja vu se rompre.
 */
export function skinOf(seat) {
  const p = S.state && S.state.players ? S.state.players[seat] : null;
  const jeu = identifiant(p && p.skin);
  const motif = identifiant(p && p.motif);
  if (!motif) return jeu;
  const base = jeu || JEU_NU;
  return GRAVES.indexOf(base) >= 0 ? base + '_' + motif : jeu;
}

/** La combinaison equivalente pour MOI, hors partie (boutique, apercu). */
export function maParure(jeu, motif) {
  const j = identifiant(jeu);
  const m = identifiant(motif);
  if (!m) return j;
  const base = j || JEU_NU;
  return GRAVES.indexOf(base) >= 0 ? base + '_' + m : j;
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
const FX_FILES = ['fx_burst.png', 'fx_place.png', 'fx_roll.png'];

const STILL_FILES = [
  'bg.jpg', 'die_unknown.png', 'cup.png', 'cup_active.png', 'brand_mark.png',
  'icon_coin.png', 'icon_anchor.png', 'icon_bell.png', 'icon_settings.png',
  'icon_shop.png', 'icon_ranking.png', 'icon_rules.png', 'icon_duel.png',
  /* ⚠️ LES CINQ DESSINS DE LA BARRE DU BAS SONT A L'ECRAN DES LA PREMIERE
     SECONDE : ils doivent etre en memoire avant, sinon la barre se peint vide
     puis se remplit sous les yeux du joueur. Seules les versions AU REPOS sont
     prechargees — les animations ne servent qu'a l'appui, et charger 686 Ko
     d'images animees que personne n'a demandees retarderait le demarrage pour
     rien. */
  'bas_shop.png', 'bas_rank.png', 'bas_succes.png', 'bas_replay.png',
  'slot_bas_home.png',
  'seal_victory.png', 'seal_defeat.png', 'seal_draw.png', 'ornament_stake.png',
  'bonus_reroll.png', 'bonus_clear_own.png', 'bonus_blast_enemy.png',
  'bonus_freeze.png', 'icon_loader.png',
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
  'cap_bonny.png', 'cap_bart.png', 'cap_lionne.png', 'cap_morgan.png', 'cap_levasseur.png',
  'trait_read.png', 'trait_teach.png', 'trait_ching.png', 'trait_omalley.png', 'trait_jack.png',
  'trait_bonny.png', 'trait_bart.png', 'trait_lionne.png', 'trait_morgan.png',
  'trait_levasseur.png',
  /* Le givre des cases. Il se pose au milieu d'un tour, sur un geste de
     l'adversaire : arrive en retard, on verrait la case rester nue une demi-
     seconde apres l'annonce — l'effet paraitrait rate. */
  'fx_gel_case.png',
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

/* ============================================================================
   LA MONNAIE MAUDITE, DESSINEE PLUTOT QUE CHARGEE.

   ⚠️ ELLE NE S'ACHETE PAS, ELLE SE GAGNE. C'est le point a ne jamais perdre de
   vue : la fiche de la boutique declare « aucun achat » aux deux magasins. La
   monnaie maudite recompense les succes, un point c'est tout — elle n'a ni prix
   ni pack, et rien dans le jeu ne doit laisser croire le contraire.

   ⚠️ ELLE EST D'ARGENT, PAS D'OR — c'est ce qui la distingue au premier coup
   d'oeil, avant meme qu'on ait lu le chiffre. Deux monnaies de la meme couleur
   cote a cote se lisent comme un seul nombre coupe en deux.
   ============================================================================ */
export const PIECE_MAUDITE =
  `<img class="dc-maudite" src="${ASSETS}img/icon_maudit.png" alt="" aria-hidden="true">`;



export const S = {
  net: null,
  /* ⚠️ LE FAUX SERVEUR D'UNE PARTIE HORS LIGNE, QUAND IL Y EN A UN. `net` ne
     suffit pas a le reconnaitre : la relance automatique n'y voit qu'un objet
     qui repond, et elle l'ecrasait par une socket neuve des que le reseau
     revenait — la table se figeait au milieu d'un tour. Ce drapeau dit « une
     partie se joue ici, ne touche pas ». Voir `connect()` dans dice.js. */
  poche: null,
  open: false,
  built: false,
  seat: -1,
  state: null,
  me: null,
  inventory: [],
  shop: [],
  /* ⚠️ LA LISTE DES CAPITAINES VIENT DU SERVEUR, ET ELLE PORTE LEURS SEUILS.
     Le client en avait une copie ecrite en dur ; le jour ou un seuil change,
     deux verites s'installent — l'ecran promet un cadenas a 25 parties pendant
     que le serveur en exige 40. On garde une liste de secours pour le premier
     rendu, et celle du serveur ecrase des l'accueil. */
  captains: [],
  /* Les succes, charges a l'ouverture de leur page — pas a l'accueil : cent
     lignes dans le message de bienvenue retarderaient le premier ecran pour une
     page que l'on n'ouvre pas a chaque session. */
  succes: null,
  /* Le journal de bord : demande a l'ouverture, oublie a la fin d'une partie. */
  historique: null,
  rules: { maxBonusPerMatch: 3, aiReward: 20, rankReward: 100 },
  panel: null,
  queued: false,
  visualLock: 0,
  rolling: false,
  awaySaid: false,
  /* Vrai entre le moment ou l'on DECIDE de quitter et l'annonce de fin qui
     suit : elle est alors avalee, celui qui part n'a pas besoin qu'on lui
     apprenne qu'il est parti. */
  quitting: false,
  wasNativeFull: false,
  sfx: null,
  musique: null,
};

/** Filled by dice.js at boot: { showMenu, renderWallet }. */
export const UI = {};

export function screen(name) {
  ['connect', 'menu', 'game'].forEach((s) => {
    const el = $('#dc-screen-' + s);
    if (el) el.classList.toggle('on', s === name);
  });
  /* ⚠️ LA BARRE DU BAS S'EFFACE PENDANT LA PARTIE, et c'est ici qu'on le dit —
     pas dans le code de l'arene. La barre est une SOEUR du corps, hors de lui :
     aucun selecteur partant de l'ecran de jeu ne peut l'atteindre. Une marque
     sur la coque, en revanche, la met a portee du style, et elle se pose au seul
     endroit qui sait deja de quel ecran on parle. */
  const coque = $('#dicewrap');
  if (coque) coque.classList.toggle('dc-en-partie', name === 'game');
}

export function boardOf(seat) {
  const game = $('#dc-screen-game');
  return game ? game.querySelector(`.dc-board[data-seat="${seat}"]`) : null;
}

/** True when the player may act: their turn, match running, no animation pending. */
export function myTurn() {
  return !!(S.state && S.state.phase === 'playing' && S.state.turn === S.seat && !S.visualLock);
}
