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

const GAP = 6;          // entre deux cases
const FRAME = 9;        // le cadre de bois du plateau (--pd-frame en portrait)
const PLATE = 26;       // une rangee de plaques de score
const BAR_PAD = 14;     // le rembourrage de la barre du lancer
const CUP_RATIO = 1.15; // le gobelet, en multiples de la case
const STACK_GAP = 4;    // entre plateau, plaques et barre
const MIN_CELL = 32;
/* ⚠️ LE PLAFOND ETAIT UN PLAFOND DE TELEPHONE. A 66 px, une tablette de
   800x1280 affichait deux plateaux minuscules separes par un grand vide : la
   case etait bornee par une constante, pas par la place disponible. Capture a
   l'appui (7 pouces, 2026-08-21). On laisse desormais la MESURE decider — elle
   sait deja tenir compte de la hauteur, de la largeur et des bandeaux — et on
   ne garde qu'un plafond de confort : au-dela, un de occupe l'ecran sans rien
   apporter. Sur telephone rien ne bouge : c'est la hauteur qui contraint, bien
   en dessous. */
const MAX_CELL = 104;

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
  let used = 0;
  for (const side of arena.querySelectorAll('.dc-side')) {
    used += side.getBoundingClientRect().height;
  }
  const gaps = 2 * parseFloat(cs.rowGap || '6');
  const height = inner - used - gaps;

  const fixed = 2 * (2 * GAP + 2 * FRAME) + 2 * PLATE + BAR_PAD + 4 * STACK_GAP;
  const byHeight = (height - fixed) / (6 + CUP_RATIO);

  const width = boards.getBoundingClientRect().width || arena.clientWidth;
  const byWidth = (width - 2 * FRAME - 2 * GAP) / 3;

  const cell = Math.floor(Math.max(MIN_CELL, Math.min(MAX_CELL, byHeight, byWidth)));
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
