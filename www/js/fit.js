/* ============================================================================
   fit.js — la taille d'une case se MESURE, elle ne se devine pas.

   La premiere version calculait la case a partir de la hauteur de l'ecran moins
   une constante (« l'entete fait 50, les bandeaux 60… »). Sur un 360x740 les
   plateaux debordaient PAR-DESSUS les bandeaux : la constante etait fausse, et
   elle le serait de toute facon sur le telephone suivant — encoche, barre de
   navigation, taille de police du systeme, tout cela bouge.

   On lit donc la place reellement accordee au bloc des plateaux, et on en deduit
   la case. Une seule inconnue, une equation :

       hauteur = 2 x (3c + 2 ecarts + 2 cadres) + 2 plaques + barre(c) + ecarts
       avec barre(c) = 1,15 c + rembourrage

   ============================================================================ */

/* ⛔ QUATRE CONSTANTES ONT DISPARU ICI, ET C'EST LA REPARATION D'UN DEFAUT
   VISIBLE. Elles decrivaient a la main ce qui entoure les neuf cases : l'ecart
   entre deux cases (6), le cadre de bois (9), la rangee de plaques (26) et
   l'ecart entre les deux (4). Trois d'entre elles avaient DERIVE avec les
   feuilles de style — l'ecart vaut 2 px en portrait, le cadre 10 — et surtout
   AUCUNE ne comptait le LISERE du plateau, quatre pixels de chaque cote, huit
   par plateau, seize en tout.

   Seize pixels reserves en trop peu, ce sont seize pixels de plateaux en trop :
   le bloc deborde de l'arene, et comme il centre son contenu, la moitie part
   PAR LE HAUT — derriere la barre de l'entete et sous l'encoche. C'est ce que
   l'admin voyait depasser au-dessus de la grille adverse, et que j'ai cherche
   trois fois du cote des messages.

   Ce fichier existe pour dire que la taille se MESURE. Il ne restait que ces
   constantes-la pour la deviner encore ; elles sont mesurees a leur tour. */
/* ⚠️ LE GOBELET N'EST PLUS DANS LA COLONNE DES PLATEAUX. Il occupait la barre
   du milieu, et on lui reservait une fraction de case — 0,58 apres avoir valu
   1,15. Les deux nombres devaient bouger ENSEMBLE avec le CSS qui le dessine,
   et ils ont diverge une fois : 0,95 reserve pour 1,15 dessine, soit 12 px
   voles aux plateaux a chaque partie sans que rien ne le signale.

   Ce couplage a disparu avec la refonte : le gobelet est descendu dans le
   bandeau du bas, dont la hauteur se MESURE comme celle des autres bandeaux.
   Plus une seule constante a tenir synchronisee avec une feuille de style. */
const MIN_CELL = 32;

/**
 * Tout ce qu'un plateau ajoute AUTOUR de ses trois rangees de cases : son
 * lisere, son cadre de bois, les deux ecarts entre rangees, la rangee de
 * plaques et l'ecart qui l'en separe. Mesure, jamais suppose.
 */
function surcout(wrap) {
  const board = wrap.querySelector('.dc-board');
  if (!board) return 0;
  const bs = getComputedStyle(board);
  const ws = getComputedStyle(wrap);
  const scores = wrap.querySelector('.dc-scores');
  return parseFloat(bs.borderTopWidth || '0') + parseFloat(bs.borderBottomWidth || '0')
       + parseFloat(bs.paddingTop || '0') + parseFloat(bs.paddingBottom || '0')
       + 2 * parseFloat(bs.rowGap || '0')
       + (scores ? scores.getBoundingClientRect().height : 0)
       + parseFloat(ws.rowGap || '0');
}

/** Ce qu'un plateau ajoute autour de ses trois COLONNES de cases. */
function surcoutLarge(wrap) {
  const board = wrap.querySelector('.dc-board');
  if (!board) return 0;
  const bs = getComputedStyle(board);
  return parseFloat(bs.borderLeftWidth || '0') + parseFloat(bs.borderRightWidth || '0')
       + parseFloat(bs.paddingLeft || '0') + parseFloat(bs.paddingRight || '0')
       + 2 * parseFloat(bs.columnGap || '0');
}
/* ⚠️ LE PLAFOND ETAIT UN PLAFOND DE TELEPHONE. A 66 px, une tablette de
   800x1280 affichait deux plateaux minuscules separes par un grand vide : la
   case etait bornee par une constante, pas par la place disponible. Capture a
   l'appui (7 pouces, 2026-08-21). On laisse desormais la MESURE decider — elle
   sait deja tenir compte de la hauteur, de la largeur et des bandeaux — et on
   ne garde qu'un plafond de confort : au-dela, un de occupe l'ecran sans rien
   apporter. Sur telephone rien ne bouge : c'est la hauteur qui contraint, bien
   en dessous. */
/* ⚠️ UN PLAFOND FIXE EST UN PLAFOND DE TELEPHONE, MEME A 104. Mesure du
   2026-08-23 sur iPad Pro 13 pouces : la place autorisait 135 px par case, le
   plafond en donnait 104, et les deux plateaux flottaient au milieu d'un grand
   vide — 30 % de la largeur utilisee. Le plafond suit donc le PLUS PETIT cote de
   l'ecran : sur un telephone (440 pt de large) il vaut 104 comme avant, sur une
   tablette il s'efface et laisse la mesure decider. */
function plafondCase() {
  const cote = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(104, cote / 4.2);
}

/** Le total des ecarts d'un conteneur : un de moins que ses enfants dans le flux. */
function ecarts(boite, cs) {
  let dans = 0;
  for (const enfant of boite.children) {
    if (getComputedStyle(enfant).position === 'absolute') continue;
    if (enfant.hasAttribute('hidden')) continue;
    dans++;
  }
  return Math.max(0, dans - 1) * parseFloat(cs.rowGap || '0');
}

function apply() {
  const wrap = document.getElementById('dicewrap');
  if (!wrap) return;

  /* ⚠️ L'echelle du texte se pose TOUJOURS, meme hors partie. Elle etait
     calculee apres le plateau — qui n'existe qu'en cours de jeu : le menu, la
     boutique et les reglages gardaient donc la taille par defaut sur tous les
     ecrans. Mesure a 320, 360, 412, 480, 740 et 800 px : echelle 1 partout. */
  scaleText(wrap);

  const arena = document.querySelector('#dicewrap .dc-arena');
  const boards = document.querySelector('#dicewrap .dc-boards');
  if (!arena || !boards) return;

  const portrait = window.matchMedia('(orientation: portrait), (max-width: 820px)').matches;
  if (!portrait) { wrap.style.removeProperty('--dc-cell'); return; }

  /* La place donnee au bloc des plateaux = l'INTERIEUR de l'arene, moins les deux
     bandeaux et les ecarts.
     ⚠️ `getBoundingClientRect()` inclut le rembourrage — dont les 72 px reserves
     en bas au ratelier. Mesurer la boite entiere, c'etait donc s'accorder 84 px
     qui n'existent pas, et les plateaux debordaient sur les bandeaux. */
  const cs = getComputedStyle(arena);
  const inner = arena.clientHeight
    - parseFloat(cs.paddingTop || '0')
    - parseFloat(cs.paddingBottom || '0');
  /* Tout ce qui n'est PAS un plateau se mesure : le bandeau du bas et la carte
     des deux capitaines. Les mesurer plutot que les estimer est ce qui a fait
     tenir cet ecran de 320 px a la tablette — et c'est ce qui lui permet
     d'encaisser la refonte sans qu'on retouche une seule constante.

     ⚠️ ON NE MESURE QUE CE QUI EST DANS LE FLUX. `.dc-turn` etait de la liste
     du temps ou l'etat du jeu tenait sa propre ligne ; il est depuis pose en
     ABSOLU au-dessus de la carte. Sa hauteur existe toujours pour
     `getBoundingClientRect`, mais elle ne coute rien a personne : la retrancher,
     c'etait voler ~26 px aux plateaux en permanence pour une pastille qui ne
     parait que deux secondes.
     Et la marge compte : `.dc-versus` en porte 8 px en haut et en bas sur
     telephone, que la boite englobante n'inclut pas. */
  let used = 0;
  for (const bloc of arena.querySelectorAll('.dc-foot, .dc-versus')) {
    const bcs = getComputedStyle(bloc);
    used += bloc.getBoundingClientRect().height
          + parseFloat(bcs.marginTop || '0')
          + parseFloat(bcs.marginBottom || '0');
  }
  const boardsCs = getComputedStyle(boards);
  /* ⚠️ LES ECARTS SE COMPTENT, ET ON NE COMPTE QUE CE QUI EST DANS LE FLUX.
     Le nombre a d'abord ete un « 3 x » herite d'une quatrieme rangee disparue,
     puis un « 2 x » ecrit a la main pour trois enfants — juste ce jour-la. Le
     lendemain, l'eventail de la cale est passe en absolu : l'arene n'a plus que
     deux enfants dans son flux, donc UN ecart, et le « 2 x » retranchait de
     nouveau un ecart fantome.
     Une constante ecrite a la main a la forme du DOM du jour se perime a la
     refonte suivante, en silence. On compte donc les enfants. */
  const gaps = ecarts(arena, cs) + ecarts(boards, boardsCs);
  const height = inner - used - gaps;

  /* Les deux plateaux existent-ils deja ? Avant la premiere partie, non : on se
     rabat alors sur une reserve prudente plutot que sur zero, qui donnerait des
     cases trop grandes le temps d'une image. */
  const enveloppes = boards.querySelectorAll('.dc-boardwrap');
  let fixed = 0;
  for (const w of enveloppes) fixed += surcout(w);
  if (!enveloppes.length) fixed = 160;
  const byHeight = (height - fixed) / 6;

  const width = boards.getBoundingClientRect().width || arena.clientWidth;
  const large = enveloppes.length ? surcoutLarge(enveloppes[0]) : 40;
  const byWidth = (width - large) / 3;

  /* ⚠️ ON NE PREND PAS TOUTE LA PLACE, ET C'EST UN CHOIX. La mesure donne la
     case la plus grande qui TIENNE ; a ce maximum les deux plateaux se touchent
     presque, la carte du centre est comprimee et le moindre pixel de plus
     deborde. Neuf dixiemes laissent respirer l'ecran et rendent la mise en page
     insensible aux petites variations — une ligne de mise qui apparait, un nom
     plus haut, une langue plus large. Demande de l'admin, et bonne pratique. */
  const AISANCE = 0.9;
  const cell = Math.floor(
    Math.max(MIN_CELL, Math.min(plafondCase(), byHeight, byWidth) * AISANCE));
  wrap.style.setProperty('--dc-cell', cell + 'px');



}

/*
 * LA TAILLE DU TEXTE SUIT L'ECRAN — LES DEUX COTES.
 *
 * Des tailles en pixels tiennent sur l'appareil ou on les a reglees, et nulle
 * part ailleurs : sur un petit ecran le texte deborde, sur une tablette il
 * flotte. Une echelle en `vw` seule ne vaut pas mieux — un ecran large et court
 * (telephone couche, ecran pliant ouvert) grossirait le texte au moment precis
 * ou la place manque en hauteur.
 *
 * On prend donc la PLUS PETITE des deux dimensions comme reference, bornee : en
 * dessous de 360 px de cote on ne descend plus (illisible), au-dela de 520 on ne
 * monte plus (une tablette n'a pas besoin d'un texte de titre partout).
 */
const BASE_SIDE = 412;                       // l'ecran de reference
const MIN_SCALE = 0.86;
const MAX_SCALE = 1.22;

function scaleText(wrap) {
  const side = Math.min(window.innerWidth, window.innerHeight * 0.52);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, side / BASE_SIDE));
  wrap.style.setProperty('--pd-ui', scale.toFixed(3));
}

let pending = 0;

function schedule() {
  if (pending) return;
  pending = requestAnimationFrame(() => { pending = 0; apply(); });
}

/**
 * Mesure maintenant, puis a chaque fois que la place change : rotation, clavier
 * qui s'ouvre, bandeau qui grandit d'une ligne quand la mise s'affiche.
 */
export function startFitting() {
  schedule();
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => setTimeout(schedule, 260));

  if (window.ResizeObserver) {
    const watch = new ResizeObserver(schedule);
    const body = document.querySelector('#dicewrap .dc-body');
    if (body) watch.observe(body);
    const arena = document.querySelector('#dicewrap .dc-arena');
    if (arena) watch.observe(arena);
    for (const side of document.querySelectorAll('#dicewrap .dc-side')) watch.observe(side);
  }

  /* L'ecran de jeu est construit APRES l'ouverture (a l'appariement) : on
     re-mesure des qu'il apparait, sinon la premiere partie garde la taille par
     defaut jusqu'a la premiere rotation. */
  const body = document.querySelector('#dicewrap .dc-body');
  if (body && window.MutationObserver) {
    new MutationObserver(schedule).observe(body, { childList: true, subtree: true });
  }
}
