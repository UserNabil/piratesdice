/* ============================================================================
   pages/dice_board.js — everything that DRAWS the dice game.

   Two notes on deliberate choices:

   • The dice faces are SVG, not images. The original game pulled every face from
     an external CDN (imagekit.io); a tool that must work on a closed LAN cannot
     depend on that, and pips drawn as circles stay crisp at any board size.

   • The boards are built once and then UPDATED in place. The server sends a full
     authoritative state after every action, so rendering is a diff against what
     is already on screen — that is what makes the animations possible (we know
     which cell just changed) and what removes the desync the original had.
   ============================================================================ */

import { fxUrl, skinOf } from './dice_state.js';

const ART = '/dice/img/';

/*
 * Les des sont des IMAGES peintes (pack_dice / pack_dice_hot), plus des pips SVG.
 * `hot` est une VRAIE image, pas un filtre : un de qui rougeoie de l'interieur ne
 * s'obtient pas en teintant un de blanc.
 */
export function dieFace(value, hot, skin) {
  const file = 'die_' + value + (hot ? '_hot' : '') + '.png';
  /* Sans parure on retombe sur le dossier d'origine : un joueur qui n'a rien
     achete ne doit rien remarquer. */
  const base = skin ? (ART + 'skins/' + skin + '/') : ART;
  return '<img class="dc-face" src="' + base + file + '" alt="" draggable="false">';
}

/** Le gobelet, au repos ou pret a lancer. */
export function cupArt(ready) {
  return '<img class="dc-cup-art" src="' + ART + (ready ? 'cup_active.png' : 'cup.png')
       + '" alt="" draggable="false">';
}

/* ⚠️ LA MEME FORME QUE LE SERVEUR, ET IL EST L'AUTORITE. Ces trois nombres
   doivent suivre `src/game/rules.js` : un plateau dessine a trois colonnes pour
   un moteur qui en compte quatre laisserait la derniere invisible — et injouable
   — sans qu'aucune erreur ne le dise. */
const COLUMNS = 4;
const COLUMN_SIZE = 3;
const CELLS = COLUMNS * COLUMN_SIZE;

function cellsOfColumn(col) {
  const base = col * COLUMN_SIZE;
  const out = [];
  for (let i = 0; i < COLUMN_SIZE; i++) out.push(base + i);
  return out;
}

/**
 * Construit un plateau vide pour un siege. `mirrored` empile les des vers le
 * centre de la table.
 *
 * ⚠️ Les plaques de score vivent HORS du plateau, dans une rangee a part : posees
 * dedans, elles tombaient sur le cadre. Le cadre est maintenant en CSS et sa
 * largeur est connue (`--pd-frame`), mais la rangee a part reste plus lisible.
 */
export function buildBoard(seat, mirrored) {
  const wrap = document.createElement('div');
  wrap.className = 'dc-boardwrap' + (mirrored ? ' dc-boardwrap-top' : '');

  const scores = document.createElement('div');
  scores.className = 'dc-scores';

  /* Le camp d'en face est BLEU, le mien VIOLET. Les deux plateaux etaient du
     meme violet et ne se distinguaient que par la luminosite : sur la capture,
     on cherchait lequel etait le sien. Une couleur repond a la question avant
     qu'on se la pose. */
  const board = document.createElement('div');
  board.className = 'dc-board pd-panel pd-panel--felt'
    + (mirrored ? ' dc-board-top pd-panel--mer' : '');
  board.dataset.seat = String(seat);

  for (let col = 0; col < COLUMNS; col++) {
    const plaque = document.createElement('div');
    plaque.className = 'dc-colscore pd-plate';
    plaque.dataset.col = String(col);
    scores.appendChild(plaque);

    const column = document.createElement('div');
    column.className = 'dc-col';
    column.dataset.col = String(col);

    const stack = document.createElement('div');
    stack.className = 'dc-stack';
    for (const cell of cellsOfColumn(col)) {
      const box = document.createElement('div');
      box.className = 'dc-cell pd-socket';
      box.dataset.cell = String(cell);
      stack.appendChild(box);
    }
    column.appendChild(stack);
    board.appendChild(column);
  }

  if (mirrored) { wrap.appendChild(board); wrap.appendChild(scores); }
  else { wrap.appendChild(scores); wrap.appendChild(board); }

  wrap.board = board;
  return wrap;
}

/**
 * Ecrit une grille sur un plateau. Une seule passe : l'etat « braise » depend du
 * nombre d'occurrences dans la colonne, et il change l'IMAGE du de — le calculer
 * apres coup obligerait a repasser sur toutes les cases.
 */
/** La parure du camp auquel appartient ce plateau. */
function parureDuPlateau(board) {
  const seat = parseInt(board && board.dataset ? board.dataset.seat : '-1', 10);
  return Number.isInteger(seat) && seat >= 0 ? skinOf(seat) : null;
}

export function renderBoard(board, grid, colScores, settle) {
  for (let col = 0; col < COLUMNS; col++) {
    const cells = cellsOfColumn(col);
    const counts = new Map();
    for (const cell of cells) {
      const v = grid[cell];
      if (v !== null) counts.set(v, (counts.get(v) || 0) + 1);
    }

    for (const cell of cells) {
      const box = board.querySelector('.dc-cell[data-cell="' + cell + '"]');
      if (!box) continue;
      const value = grid[cell];
      const hot = value !== null && counts.get(value) > 1;
      const want = value === null ? '' : (value + (hot ? 'h' : ''));
      const before = box.dataset.face;
      if (before === want) continue;
      const wasEmpty = !before;
      box.dataset.face = want;
      /* Le plateau porte son siege dans `data-seat` : la parure se deduit de
         lui, sans qu'on ait a la faire descendre par chaque appelant. */
      box.innerHTML = value === null ? '' : dieFace(value, hot, parureDuPlateau(board));
      box.classList.toggle('dc-cell-filled', value !== null);
      box.classList.toggle('dc-pair', hot);
      // Le tassement d'une colonne : les des survivants TOMBENT dans les cases
      // liberees. Sans cette chute, un de « apparaissait » a la fin de la salve
      // et se lisait comme un de ressuscite.
      if (settle && wasEmpty && value !== null) {
        /* Un de qui SE TASSE n'est pas un de qu'on POSE : si la case portait
           encore la pose precedente, on la retire avant d'animer la chute. */
        box.classList.remove('dc-drop');
        box.classList.remove('dc-settled');
        void box.offsetWidth;
        box.classList.add('dc-settled');
        setTimeout(() => box.classList.remove('dc-settled'), 620);
      }
    }

    const label = board.parentNode
      && board.parentNode.querySelector('.dc-colscore[data-col="' + col + '"]');
    /* ⚠️ UNE COLONNE A ZERO GARDE SA PLAQUE, ET ELLE AFFICHE ZERO. Le chiffre
       etait efface : il restait une pastille doree et vide, qui ressemblait a
       un compteur en panne plutot qu'a un score nul. Quatre plaques, quatre
       chiffres, toujours — et celle qui ne rapporte encore rien s'eteint au
       lieu de disparaitre. */
    if (label) {
      label.textContent = String(colScores[col]);
      label.classList.toggle('dc-colscore-zero', !colScores[col]);
    }
  }
}

/*
 * LA POSE D'UN DE. Un `transition` generique ne dit rien : un de a un poids, il
 * tombe, il rebondit une fois, il souleve de la poussiere et le plateau accuse le
 * coup. Les trois choses arrivent ensemble, sinon ca reste une image qui apparait.
 */
export function markPlaced(board, cell) {
  const box = board.querySelector('.dc-cell[data-cell="' + cell + '"]');
  if (!box) return;
  box.classList.remove('dc-drop');
  void box.offsetWidth;
  box.classList.add('dc-drop');
  /* ⚠️ LA CLASSE DOIT PARTIR AVEC SON ANIMATION. Elle restait collee a la case
     pour toujours — or `.dc-drop > .dc-face` anime N'IMPORTE QUELLE image qui
     entre ensuite dans cette case. Un de detruit puis remplace par celui du
     dessus rejouait donc une POSE de 0,62 s en plus de sa chute : deux
     animations de depot pour un seul mouvement, exactement la ou une colonne
     venait de se tasser. 620 ms = la duree de `dc-fall` (0,62 s). */
  setTimeout(() => box.classList.remove('dc-drop'), 620);

  // fx_place : 30 images. Horodate pour repartir de la premiere a chaque pose.
  const dust = document.createElement('span');
  dust.className = 'dc-dust';
  dust.style.backgroundImage = "url('" + fxUrl('fx_place.png', 1400) + "')";
  box.appendChild(dust);
  setTimeout(() => dust.remove(), 1100);

  board.classList.remove('dc-thud');
  void board.offsetWidth;
  board.classList.add('dc-thud');
  setTimeout(() => board.classList.remove('dc-thud'), 300);
}

/**
 * LE LANCER. Le de ne doit pas simplement apparaitre : on fait rouler les faces
 * quelques dixiemes de seconde avant de s'arreter sur la vraie. C'est ce qui
 * donne l'impression qu'il a ete jete, et non pioche.
 */
/* ⚠️ LA PARURE SE PASSE, ELLE NE SE DEVINE PAS. Le roulement dessinait ses
   faces avec `dieFace(v)` — sans parure, donc avec les des D'ORIGINE. Un joueur
   qui a achete un jeu voyait rouler des des qui ne sont pas les siens, puis se
   poser les bons : l'achat semblait ne pas avoir pris. */
export function tumble(el, finalValue, done, skin) {
  // 14 x 95 ms = 1,33 s : la duree de fx_roll (36 images). A 385 ms on ne
  // voyait qu'un clignotement illisible.
  let ticks = 0;
  const total = 14;
  el.classList.add('dc-tumbling');
  const shake = document.createElement('span');
  shake.className = 'dc-rollfx';
  shake.style.backgroundImage = "url('" + fxUrl('fx_roll.png', 1800) + "')";
  el.appendChild(shake);
  setTimeout(() => shake.remove(), 1400);
  const timer = setInterval(() => {
    ticks++;
    if (ticks >= total) {
      clearInterval(timer);
      el.classList.remove('dc-tumbling');
      el.innerHTML = dieFace(finalValue, false, skin);
      el.classList.remove('dc-settle');
      void el.offsetWidth;
      el.classList.add('dc-settle');
      if (done) done();
      return;
    }
    el.innerHTML = dieFace(1 + Math.floor(Math.random() * 6), false, skin);
  }, 95);
}

/** L'apercu de la case ou le de tomberait : on montre AVANT de cliquer. */
export function showLanding(board, cell, value) {
  clearLanding(board);
  const box = board.querySelector('.dc-cell[data-cell="' + cell + '"]');
  if (!box) return;
  const ghost = document.createElement('span');
  ghost.className = 'dc-ghost';
  /* Le de annonce : il porte la parure du plateau ou il va tomber. */
  ghost.innerHTML = dieFace(value, false, parureDuPlateau(board));
  box.appendChild(ghost);
  box.classList.add('dc-landing');
}

export function clearLanding(board) {
  board.querySelectorAll('.dc-ghost').forEach((g) => g.remove());
  board.querySelectorAll('.dc-landing').forEach((b) => b.classList.remove('dc-landing'));
}

/** La premiere case libre d'une colonne, ou -1. */
export function freeCellOf(grid, col) {
  for (const cell of cellsOfColumn(col)) if (grid[cell] === null) return cell;
  return -1;
}

const BLAST_STEP = 210;
const BLAST_LIFE = 1155;                // duree exacte de fx_burst : 35 images
/* ⚠️ CE N'EST PLUS UN GARDE-FOU CONTRE LA BOUCLE, C'EST UN SIMPLE MENAGE.
   La planche bouclait sans fin (`num_plays = 0` dans son chunk acTL) : la seule
   defense etait de la retirer de l'ecran avant qu'elle ne recommence, donc de
   connaitre sa duree a la milliseconde. A 1250 pour 1155 reels, on revoyait
   95 ms du PREMIER carre rouge — ce que l'admin decrit comme « un debut de carre
   rouge pre-explosion ». Le fichier a ete reecrit en `num_plays = 1` : il ne
   peut plus rejouer, quoi qu'on fasse ici. Cette valeur ne sert donc plus qu'a
   liberer l'element, et elle vaut la duree exacte lue dans les chunks fcTL. */
const BLAST_SETTLE = 520;               // le plateau se tasse PENDANT l'explosion

/**
 * Plays the explosion over each destroyed cell. Returns when the board may be
 * redrawn — la ou la derniere explosion a pris son elan, PAS a sa fin : le
 * tassement doit se lire comme la consequence du souffle, pas comme un
 * evenement separe une seconde et demie plus tard.
 */
export function blastCells(board, cells, onEachBoom) {
  board.classList.remove('dc-quake');
  void board.offsetWidth;
  board.classList.add('dc-quake');
  setTimeout(() => board.classList.remove('dc-quake'), 480);

  cells.forEach((cell, index) => {
    setTimeout(() => {
      const box = board.querySelector(`.dc-cell[data-cell="${cell}"]`);
      if (!box) return;
      if (onEachBoom) onEachBoom();
      // Le de part AVEC son explosion, pas a la fin de la salve. Sinon la
      // premiere case redevenait visible pendant que les suivantes explosaient
      // encore : le de « reapparaissait » avant d'etre efface par le repaint.
      box.innerHTML = '';
      box.dataset.face = '';
      box.classList.remove('dc-cell-filled', 'dc-pair');
      const flash = document.createElement('span');
      flash.className = 'dc-blast';
      // Recree a chaque fois ET horodate : sans le parametre, le navigateur
      // rejouerait l'APNG depuis son cache a la position ou il l'avait laissee.
      flash.style.backgroundImage = "url('" + fxUrl('fx_burst.png', BLAST_LIFE + 400) + "')";
      box.appendChild(flash);
      setTimeout(() => flash.remove(), BLAST_LIFE);
    }, index * BLAST_STEP);
  });
  return cells.length ? (cells.length - 1) * BLAST_STEP + BLAST_SETTLE : 0;
}

/** Small sound bank. Silent by default is NOT an error: audio may be blocked. */
export class Sfx {
  constructor(base) {
    this.base = base;
    this.muted = false;
    this.cache = new Map();
    /* ⛔ LE JEU CONTINUAIT DE PARLER DEPUIS L'ECRAN D'ACCUEIL DU TELEPHONE. Un
       son declenche juste avant que l'application passe en arriere-plan finit
       de se jouer dehors — et sur iOS un `<audio>` deja lance survit au
       passage. « Le son persiste alors que je suis sur le home, ce n'est pas
       normal » : non, et c'est a nous de le couper.
       On garde donc les voix en cours pour pouvoir les faire taire, et on
       refuse d'en ouvrir de nouvelles tant que l'ecran n'est pas revenu. */
    this.voix = new Set();
    this.dehors = false;
    /* ⚠️ LE NIVEAU DU CANAL, EN FACTEUR. Chaque appel a `play()` porte deja son
       volume, regle a la main son par son : le de sec a 0,42, l'onglet a 0,22.
       Ce melange-la est le bon et on n'y touche pas — le reglage du joueur le
       multiplie en bloc, ce qui le baisse sans le deformer. A 0, on ne joue
       rien du tout : ouvrir une voix muette couterait un decodage pour du
       silence. */
    this.niveau = 1;
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.dehors = document.hidden;
        if (document.hidden) this.taire();
      });
    }
  }

  /** Couper net tout ce qui est en train de sonner. */
  taire() {
    for (const voix of this.voix) {
      try { voix.pause(); voix.currentTime = 0; } catch (_) { /* deja finie */ }
    }
    this.voix.clear();
  }

  load(name, file) {
    const audio = new Audio(this.base + file);
    audio.preload = 'auto';
    this.cache.set(name, audio);
  }

  /**
   * `rate` change la hauteur ET la duree : c'est ce qui permet de tirer deux
   * bruits differents d'un seul echantillon. Le jeu n'a qu'un son de de ; joue
   * plus vite et plus fort, il devient le claquement sec d'un de qui se pose.
   */
  play(name, volume, rate) {
    if (this.muted || this.dehors || !this.niveau) return;
    const source = this.cache.get(name);
    if (!source) return;
    try {
      const voice = source.cloneNode();
      /* `volume` d'un <audio> refuse tout ce qui sort de [0,1] — et le refus
         est une exception, pas un ecretage. On borne donc nous-memes. */
      const cible = (volume === undefined ? 0.35 : volume) * this.niveau;
      voice.volume = Math.min(1, Math.max(0, cible));
      if (rate) voice.playbackRate = rate;
      this.voix.add(voice);
      voice.addEventListener('ended', () => this.voix.delete(voice), { once: true });
      const p = voice.play();
      if (p && p.catch) p.catch(() => { /* autoplay policy — not worth a message */ });
    } catch (_) { /* no audio device */ }
  }
}
