/* ============================================================================
   pages/dice_regles.js — LES REGLES, COPIEES DU SERVEUR. NE PAS MODIFIER ICI.

   ⛔ CE FICHIER EST ENGENDRE par `outils/porter_regles.py` depuis
   `dice-server/src/game/rules.js`. Toute correction se fait LA-BAS, puis on
   relance l'outil. Une retouche a la main ici creerait exactement ce qu'on
   cherche a eviter : deux regles du jeu qui divergent en silence, et un ecran
   qui affiche un total que la partie n'a jamais eu.

   Il sert au mode HORS LIGNE, ou le telephone doit marquer les points tout
   seul. En ligne, c'est toujours le serveur qui tranche.
   ============================================================================ */

/* ⚠️ QUATRE COLONNES, PAS TROIS. La table s'est elargie : douze des par
   plateau au lieu de neuf. La HAUTEUR ne bouge pas — c'est elle qui porte le
   score (valeur x occurrences dans la colonne), et la toucher aurait change
   tout l'equilibre du jeu ; la largeur, elle, n'ajoute que du choix. */
const COLUMNS = 4;
const COLUMN_SIZE = 3;
const CELLS = COLUMNS * COLUMN_SIZE;
const DIE_FACES = 6;
/* La colonne benie vaut 15 % de plus. Le nom a change avec l'effet : ce n'est
   plus une prime au triple, c'est une benediction que l'on pose. */
const BOOST_MULTIPLIER = 1.15;
/* La colonne MAUDITE vaut 15 % de moins : le miroir exact de la benediction.
   Olivier Levasseur en offre une par partie, comme Grace O'Malley offre la
   sienne — « au contraire de Grace O'Malley, il peut maudire une colonne ».

   ⚠️ MEME AMPLITUDE DES DEUX COTES, ET C'EST VOULU. Une malediction plus forte
   que la benediction aurait fait de Levasseur un meilleur O'Malley, et le
   choix entre les deux capitaines n'aurait plus rien eu d'un choix : on prend
   toujours celui qui frappe le plus fort. A 15 % contre 15 %, l'un construit
   et l'autre demolit pour le meme prix — c'est le style qui departage. */
const CURSE_MULTIPLIER = 0.85;

/* Les quarts du pont : toujours ces valeurs-la, dans un ordre tire au debut de
   chaque partie. Un ecart de 1,3 a 0,8 se lit d'un coup d'oeil et pese sur le
   choix sans ecraser le jeu — a 2,0 la partie se resumerait a une seule
   colonne, a 1,1 personne ne le remarquerait.

   ⚠️ LA QUATRIEME COLONNE PUNIT DEUX FOIS PLUS. Elle avait d'abord ete posee
   neutre ; a l'usage, deux colonnes a 1 rendaient le choix mou — la moitie du
   plateau se valait. A 0,5, chaque pose se decide vraiment : une colonne qui
   rapporte, une qui coute, une qui coute BEAUCOUP, et une neutre. La moyenne
   descend a 0,9 : les scores baissent un peu, les DECISIONS pesent plus. */
const QUARTERS = [1.3, 1, 0.8, 0.5];

function emptyGrid() {
  return new Array(CELLS).fill(null);
}

function columnOf(cell) {
  return Math.floor(cell / COLUMN_SIZE);
}

function cellsOfColumn(col) {
  const base = col * COLUMN_SIZE;
  /* Ecrit a partir de COLUMN_SIZE, pas des trois cases d'origine : une hauteur
     qui change un jour ne doit pas laisser une liste figee derriere elle. */
  const out = [];
  for (let i = 0; i < COLUMN_SIZE; i++) out.push(base + i);
  return out;
}

function columnValues(grid, col) {
  return cellsOfColumn(col).map((i) => grid[i]);
}

function isColumnFull(grid, col) {
  return columnValues(grid, col).every((v) => v !== null);
}

function isFull(grid) {
  return grid.every((v) => v !== null);
}

function isEmpty(grid) {
  return grid.every((v) => v === null);
}

function freeCellInColumn(grid, col) {
  for (const cell of cellsOfColumn(col)) {
    if (grid[cell] === null) return cell;
  }
  return -1;
}

function place(grid, col, value) {
  const cell = freeCellInColumn(grid, col);
  if (cell < 0) return { grid, cell: -1 };
  const next = grid.slice();
  next[cell] = value;
  return { grid: next, cell };
}

function compact(grid) {
  const next = emptyGrid();
  for (let col = 0; col < COLUMNS; col++) {
    const kept = columnValues(grid, col).filter((v) => v !== null);
    const cells = cellsOfColumn(col);
    kept.forEach((v, i) => { next[cells[i]] = v; });
  }
  return next;
}

/*
 * `opts.boost` est la colonne BENIE : elle vaut 15 % de plus.
 *
 * ⚠️ AVANT, LES 15 % TOMBAIENT TOUT SEULS sur toute colonne de trois des
 * identiques, pour qui jouait Grace O'Malley. Passif, donc invisible : on ne
 * decidait rien, on constatait. C'est desormais un effet qu'on JOUE, sur la
 * colonne de son choix — O'Malley en offre un par partie, les autres l'achetent.
 *
 * On l'applique ICI et nulle part ailleurs, pour qu'aucun ecran ne puisse
 * afficher un total different de celui qui decide de la partie.
 */
function columnScore(grid, col, opts) {
  const counts = new Map();
  for (const v of columnValues(grid, col)) {
    if (v === null) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let score = 0;
  for (const [value, n] of counts) score += value * n * n;
  /* ⚠️ LES TROIS QUARTS DU PONT. Toutes les colonnes se valaient : choisir la
     gauche ou la droite ne changeait rien tant que le contenu etait le meme, et
     la decision se reduisait a « ou puis-je empiler ». Un multiplicateur par
     colonne, tire au debut et visible des deux cotes, fait de CHAQUE pose un
     arbitrage — empiler sur la colonne riche, ou sur celle que l'adversaire ne
     peut plus atteindre. Il s'applique AVANT la benediction : celle-ci majore un
     score deja pondere, sinon deux effets multiplicatifs se marchent dessus. */
  const quarts = opts && opts.quarters;
  if (quarts && typeof quarts[col] === 'number') score = Math.round(score * quarts[col]);
  if (opts && opts.boost === col) score = Math.round(score * BOOST_MULTIPLIER);
  /* ⚠️ LA MALEDICTION PASSE APRES LA BENEDICTION, ET LES DEUX PEUVENT TOMBER
     SUR LA MEME COLONNE. Rien ne l'interdit : l'un vise sa propre grille,
     l'autre celle d'en face, et une colonne benie puis maudite finit a 97,75 %
     de sa valeur — presque rien, ce qui est exactement juste. Deux effets qui
     s'annulent doivent s'annuler, pas se disputer un drapeau unique. */
  if (opts && opts.curse === col) score = Math.round(score * CURSE_MULTIPLIER);
  return score;
}

/**
 * Tirer les trois quarts du pont.
 *
 * ⚠️ LA SOMME EST CONSTANTE, ET C'EST TOUT L'INTERET. Trois multiplicateurs
 * tires librement feraient des parties riches et des parties pauvres, donc un
 * hasard sur le SCORE et non sur la decision. En permutant toujours le meme jeu
 * de valeurs, la partie vaut exactement autant a chaque fois — seule leur
 * REPARTITION change, et c'est elle qu'on doit lire.
 */
function drawQuarters(rng) {
  const jeu = QUARTERS.slice();
  for (let i = jeu.length - 1; i > 0; i--) {
    const j = Math.floor((rng ? rng() : Math.random()) * (i + 1));
    const t = jeu[i]; jeu[i] = jeu[j]; jeu[j] = t;
  }
  return jeu;
}


function columnScores(grid, opts) {
  const out = [];
  for (let col = 0; col < COLUMNS; col++) out.push(columnScore(grid, col, opts));
  return out;
}

function totalScore(grid, opts) {
  return columnScores(grid, opts).reduce((a, b) => a + b, 0);
}

/**
 * Retire d'UNE colonne tous les des d'une valeur donnee — le coup d'ouverture
 * de Barbe-Noire. La destruction normale compare la colonne entiere ; celle-ci
 * vise une valeur precise, dans une colonne precise.
 */
function destroyValueInColumn(grid, col, value) {
  const destroyed = [];
  const next = grid.slice();
  for (const cell of cellsOfColumn(col)) {
    if (next[cell] === value) { next[cell] = null; destroyed.push(cell); }
  }
  return { grid: destroyed.length ? compact(next) : next, destroyed };
}

function destroyMatching(myGrid, oppGrid) {
  const destroyed = [];
  const next = oppGrid.slice();
  for (let col = 0; col < COLUMNS; col++) {
    const mine = columnValues(myGrid, col).filter((v) => v !== null);
    for (const cell of cellsOfColumn(col)) {
      const v = next[cell];
      if (v !== null && mine.includes(v)) {
        next[cell] = null;
        destroyed.push(cell);
      }
    }
  }
  return { grid: destroyed.length ? compact(next) : next, destroyed };
}

/**
 * RASER UNE COLONNE ENTIERE — le canon de Ching Shih.
 *
 * ⚠️ ON TASSE COMME PARTOUT AILLEURS. Une colonne videe n'a rien a tasser
 * puisqu'il ne reste rien dedans ; on passe quand meme par `compact` pour que
 * ce chemin ne soit pas le seul du fichier a rendre une grille non tassee le
 * jour ou la hauteur changera.
 *
 * Rend les cases REELLEMENT emportees : une colonne a moitie pleine n'en
 * annonce pas trois, sinon l'ecran ferait exploser des cases vides.
 */
function clearColumn(grid, col) {
  if (col < 0 || col >= COLUMNS) return { grid, cells: [] };
  const cells = [];
  const next = grid.slice();
  for (const cell of cellsOfColumn(col)) {
    if (next[cell] === null) continue;
    next[cell] = null;
    cells.push(cell);
  }
  return { grid: cells.length ? compact(next) : next, cells };
}

/**
 * ECHANGER LE DE D'UNE CASE CONTRE CELUI D'EN FACE — le tour de Black Bart.
 *
 * ⚠️ MEME INDICE DES DEUX COTES, ET LA GRILLE NE BOUGE PAS AUTREMENT. C'est un
 * troc, pas une destruction : rien ne disparait, donc rien a tasser. Les deux
 * cases doivent porter un de — echanger contre du vide serait un deplacement
 * deguise, et un deplacement gratuit vaut bien plus qu'un echange.
 */
function swapCell(gridA, gridB, cell) {
  if (cell < 0 || cell >= CELLS) return { a: gridA, b: gridB, ok: false };
  if (gridA[cell] === null || gridB[cell] === null) return { a: gridA, b: gridB, ok: false };
  const a = gridA.slice();
  const b = gridB.slice();
  a[cell] = gridB[cell];
  b[cell] = gridA[cell];
  return { a, b, ok: true };
}

function clearCell(grid, cell) {
  if (cell < 0 || cell >= CELLS || grid[cell] === null) return { grid, ok: false };
  const next = grid.slice();
  next[cell] = null;
  return { grid: compact(next), ok: true };
}

function rollDie(rng) {
  const r = rng ? rng() : Math.random();
  return Math.min(DIE_FACES, Math.floor(r * DIE_FACES) + 1);
}

function expectedScore(myRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - myRating) / 400));
}

function ratingDelta(myRating, opponentRating, result, k) {
  if (![0, 0.5, 1].includes(result)) return null;
  return Math.round((k || 32) * (result - expectedScore(myRating, opponentRating)));
}

/**
 * QUI voit sa note bouger dans ce match, et sinon POURQUOI.
 *
 * ⛔ AVANT, TOUT MATCH ENTRE DEUX HUMAINS COMPTAIT, et le classement se
 * fabriquait avec un second compte : on s'appariait, l'autre abandonnait, on
 * montait. Rien dans la formule d'Elo ne s'y oppose — elle suppose deux
 * joueurs qui essaient de gagner, ce qui n'est pas une hypothese qu'un serveur
 * peut se permettre.
 *
 * Les quatre conditions ci-dessous ne changent pas le calcul : elles decident
 * s'il a lieu. Elles sont ecrites ici, sans base de donnees ni reseau, pour
 * qu'on puisse les lire et les eprouver une par une.
 *
 * ⚠️ CE N'EST PAS SYMETRIQUE, ET C'EST VOULU. Un joueur EN PLACEMENT continue
 * de se placer meme quand son adversaire ne gagne rien : sans cela un compte
 * neuf n'aurait jamais de note, donc ne deviendrait jamais classe, et le
 * classement se refermerait sur ceux qui y sont deja.
 *
 * @param a,b     { rating, games } — l'etat des deux joueurs AVANT la partie
 * @param options { placement, ecartMax, coups, coupsMini, paires, paireMax }
 * @returns [{ bouge, raison }, { bouge, raison }]
 */
function notesEnJeu(a, b, options) {
  const o = options || {};
  const placement = o.placement || 0;
  const ecartMax = o.ecartMax || Infinity;
  const paireMax = o.paireMax || Infinity;
  const bloque = (raison) => [{ bouge: false, raison }, { bouge: false, raison }];

  /* Une table qu'on quitte avant d'avoir joue n'est pas une partie. */
  if (o.coupsMini && (o.coups || 0) < o.coupsMini) return bloque('short');
  /* Les memes deux joueurs, encore et encore : c'est la forme meme du farming. */
  if ((o.paires || 0) >= paireMax) return bloque('pair');

  const classe = [a.games >= placement, b.games >= placement];
  const proche = Math.abs(a.rating - b.rating) <= ecartMax;

  return [0, 1].map((i) => {
    if (!classe[i]) return { bouge: true, raison: null };   // il se place encore
    if (!classe[1 - i]) return { bouge: false, raison: 'new' };
    if (!proche) return { bouge: false, raison: 'gap' };
    return { bouge: true, raison: null };
  });
}

/**
 * Ce qu'une partie met dans la bourse.
 *
 * ⛔ AVANT, TOUTE VICTOIRE PAYAIT LA MEME SOMME — dix pieces, que l'adversaire
 * soit une machine ou un champion. La bourse ne disait rien de ce qu'on avait
 * fait. Elle paie desormais deux choses distinctes : le TEMPS passe contre la
 * machine, et la MONTEE au classement, qui est la seule chose qui se merite.
 *
 * ⚠️ ET UNE TABLE OUVERTE PUIS REFERMEE NE PAIE RIEN. Une prime de
 * participation sans cette condition se ramasse en boucle sans jouer.
 */
function prime(quoi, montants) {
  if (!quoi || !quoi.jouee) return 0;
  if (quoi.contreIA) return montants.ia || 0;
  return quoi.monte ? (montants.rang || 0) : 0;
}

function newRating(myRating, opponentRating, result, k) {
  const delta = ratingDelta(myRating, opponentRating, result, k);
  if (delta === null) return myRating;
  return Math.max(0, myRating + delta);
}

export {
  COLUMNS,
  COLUMN_SIZE,
  CELLS,
  DIE_FACES,
  QUARTERS,
  emptyGrid,
  columnOf,
  cellsOfColumn,
  columnValues,
  isColumnFull,
  isFull,
  isEmpty,
  freeCellInColumn,
  place,
  compact,
  columnScore,
  columnScores,
  totalScore,
  drawQuarters,
  destroyMatching,
  destroyValueInColumn,
  clearCell,
  clearColumn,
  swapCell,
  rollDie,
};
