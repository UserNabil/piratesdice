/* ============================================================================
   pages/dice_horsligne.js — JOUER SANS RESEAU, ET POUVOIR LE PROUVER.

   ⛔ CE MOTEUR NE DECIDE DE RIEN QUI COMPTE. Il fait tourner une partie sur le
   telephone pour qu'on puisse jouer dans le metro ; mais le score, les pieces et
   les hauts faits ne sont acquis qu'apres verification par le serveur, au
   retour. Ici on JOUE ; la-bas on TRANCHE.

   ⚠️ LES DES NE SONT PAS TIRES ICI. Ils sortent de la graine d'un jeton remis
   par le serveur pendant qu'on etait connecte. Au retour, le serveur refait le
   meme tirage et compare : c'est ce qui rend la triche inutile, sans avoir a
   faire confiance au telephone. Voir dice-server/src/game/horsligne.js.

   ⛔ L'ORDRE DE CONSOMMATION DU HASARD EST UN CONTRAT AVEC LE SERVEUR :
        1. les quarts du pont (drawQuarters),
        2. puis UN tirage par de, dans l'ordre du journal.
   Rien d'autre ne doit toucher au generateur. Ajouter ici un tirage — pour une
   animation, pour un choix de l'IA — decalerait toute la suite et ferait
   REJETER des parties honnetes. C'est la raison pour laquelle l'IA de ce
   fichier ne tire jamais au sort : elle est deterministe.

   ⚠️ ET LA LONGUE-VUE N'EXISTE PAS HORS LIGNE. Montrer le de suivant demande de
   le tirer d'avance, donc de casser cet ordre. Un effet absent vaut mieux
   qu'une verification qui ment ; le serveur refuse d'ailleurs ce coup-la.
   ============================================================================ */

import * as R from './dice_regles.js';
import { generateur } from './dice_hasard.js';

const MAX_EFFETS = 3;

/* ─────────────────────────────────────────────────────────── l'adversaire ── */

/**
 * L'IA hors ligne : elle pese chaque colonne et prend la meilleure.
 *
 * ⛔ ELLE NE TIRE JAMAIS AU SORT — ni pour departager, ni pour varier. Un seul
 * appel au generateur decalerait la suite des des et ferait rejeter la partie
 * par le serveur. En cas d'egalite, c'est la colonne la plus a gauche : arbitraire,
 * mais reproductible, et c'est tout ce qu'on lui demande.
 *
 * ⚠️ ELLE EST PLUS SIMPLE QUE CELLE DU SERVEUR, ET C'EST ASSUME. L'IA en ligne
 * explore l'arbre des coups avec un budget de temps ; la refaire ici couterait
 * des centaines de millisecondes par coup sur un telephone, pour un adversaire
 * qu'on affronte justement quand on n'a rien d'autre a faire. Celle-ci regarde
 * un coup en avant : elle joue correctement, elle ne joue pas au mieux.
 */
function coupDeLaMachine(etat, siege) {
  const moi = etat.grilles[siege];
  const lui = etat.grilles[1 - siege];
  const valeur = etat.des[siege];
  let meilleure = -1;
  let meilleurGain = -Infinity;

  for (let col = 0; col < R.COLUMNS; col++) {
    if (R.isColumnFull(moi, col)) continue;
    /* ⛔ ET JAMAIS LA COLONNE GELEE. `poser()` la refuse : la machine aurait
       choisi une colonne interdite, la pose serait revenue nulle, et
       `tourDeLaMachine` aurait rendu la main sans avoir joue — la meme table
       figee que sur le serveur, en pire, puisqu'il n'y a ici aucune pendule
       pour la denouer. */
    if (etat.geleCol[siege] === col) continue;
    const apres = R.place(moi, col, valeur).grid;
    const gagne = R.totalScore(apres, opts(etat, siege)) - R.totalScore(moi, opts(etat, siege));
    /* Ce que la pose emporte chez l'autre compte double dans la decision : un
       point pris est un point qu'il ne marquera pas. */
    const emporte = R.destroyMatching(apres, lui).destroyed.length;
    const perte = emporte
      ? R.totalScore(lui, opts(etat, 1 - siege))
        - R.totalScore(R.destroyMatching(apres, lui).grid, opts(etat, 1 - siege))
      : 0;
    const note = gagne + perte;
    if (note > meilleurGain) { meilleurGain = note; meilleure = col; }
  }
  return meilleure;
}

function opts(etat, siege) {
  return { quarters: etat.quarts, boost: etat.boost[siege], curse: etat.maudit[siege] };
}

/* ─────────────────────────────────────────────────────────────── la partie ── */

/**
 * Une partie hors ligne. Elle produit les MEMES instantanes que le serveur :
 * l'ecran de jeu ne sait pas qu'il n'y a personne au bout du fil.
 */
export class PartieHorsLigne {
  constructor({ jeton, graine, moi, capitaines, parures, noms, regles }) {
    this.jeton = jeton;
    this.rng = generateur(graine);
    this.moi = moi === 1 ? 1 : 0;
    this.capitaines = capitaines || ['read', 'read'];
    this.parures = parures || [null, null];
    this.noms = noms || ['', 'IA'];
    this.maxEffets = (regles && regles.maxBonusPerMatch) || MAX_EFFETS;

    /* ⚠️ LES QUARTS EN PREMIER : c'est la premiere chose que le serveur tirera
       de la meme graine au moment de verifier. */
    this.quarts = R.drawQuarters(this.rng);
    this.grilles = [R.emptyGrid(), R.emptyGrid()];
    this.des = [null, null];
    this.boost = [null, null];
    /* Les trois etats neufs, exactement comme sur le serveur : la colonne
       maudite (qui dure), la colonne gelee (un seul tour) et le tour vole. */
    this.maudit = [null, null];
    this.geleCol = [-1, -1];
    this.gele = [false, false];
    this.effets = [[], []];
    this.gratuitUtilise = [false, false];
    this.tour = 0;
    /* L'instant de la derniere pique : personne ne parle deux fois de suite. */
    this.dernierePique = 0;
    this.finie = false;
    this.journal = [];
  }

  get etat() { return this; }

  /** Le journal, tel que le serveur l'attend. */
  auJournal() {
    return { v: 2, mode: 'solo', horsLigne: true, capitaines: this.capitaines.slice(),
             quarts: this.quarts.slice(), coups: this.journal };
  }

  noter(ligne) {
    if (this.journal.length < 190) this.journal.push(ligne);
  }

  /** L'instantane, dans la forme exacte que l'ecran de jeu attend du serveur. */
  instantane() {
    const s = (i) => ({ quarters: this.quarts, boost: this.boost[i], curse: this.maudit[i] });
    return {
      matchId: 'hors-ligne',
      captains: this.capitaines.slice(),
      traits: [null, null],
      freeReroll: [0, 0],
      freeBonus: [null, null],
      gele: this.gele.slice(),
      /* ⚠️ TROIS CHAMPS QUI VALENT TOUJOURS « RIEN », ET QUI DOIVENT QUAND MEME
         ETRE LA. Le mode hors ligne n'a ni capitaines ni effets — `traits` et
         `freeBonus` sont deja nuls plus haut pour la meme raison. Mais l'ecran
         de jeu est le MEME code : `renderGel` et `renderMaudit` lisent ces
         champs a chaque instantane. Les omettre marche par accident (les gardes
         `st.geleCol ? … : -1` retombent sur rien), et un accident qui marche est
         une panne qui attend. On declare la forme entiere. */
      geleCol: this.geleCol.slice(),
      maudCol: [this.maudit[0] === null ? -1 : this.maudit[0],
                this.maudit[1] === null ? -1 : this.maudit[1]],
      tourCourt: [false, false],
      boostCol: this.boost.slice(),
      quarters: this.quarts.slice(),
      foresee: null,
      foreseeOpen: [false, false],
      mode: 'solo',
      phase: this.finie ? 'over' : 'playing',
      turn: this.tour,
      dice: this.des.slice(),
      grids: [this.grilles[0].slice(), this.grilles[1].slice()],
      columnScores: [R.columnScores(this.grilles[0], s(0)), R.columnScores(this.grilles[1], s(1))],
      totals: [R.totalScore(this.grilles[0], s(0)), R.totalScore(this.grilles[1], s(1))],
      bonusJoues: [this.effets[0].slice(), this.effets[1].slice()],
      bonusLeft: [this.maxEffets - this.effets[0].length, this.maxEffets - this.effets[1].length],
      bonusStock: [this.maxEffets - this.effets[0].length, this.maxEffets - this.effets[1].length],
      /* ⚠️ VISER N'EST PAS UN ETAT DU MOTEUR. Il prend la case en ARGUMENT de
         `effet()` : il n'a jamais d'effet a moitie joue, et son instantane est
         aussi ce que le verificateur du serveur rejoue. C'est la couche qui
         parle a l'ecran — `dice_solo.js`, `avecVisee()` — qui remplit ce champ
         pendant qu'on vise. Le laisser en dur a `null` LA-BAS aussi a rendu les
         sept effets a cible injouables hors ligne. */
      pending: null,
      players: [0, 1].map((i) => ({
        name: this.noms[i] || (i === this.moi ? '' : 'IA'),
        rating: 0, ai: i !== this.moi, connected: true,
        skin: this.parures[i] && this.parures[i].skin,
        motif: this.parures[i] && this.parures[i].motif,
      })),
    };
  }

  /** Lancer le de du siege courant. Un seul tirage, note au journal. */
  lancer(siege) {
    if (this.finie || this.tour !== siege || this.des[siege] !== null) return null;
    const v = R.rollDie(this.rng);
    this.des[siege] = v;
    this.noter({ t: 'roll', s: siege, v });
    return [{ kind: 'roll', seat: siege, value: v }];
  }

  /** Poser le de dans une colonne. Renvoie les effets a jouer a l'ecran. */
  poser(siege, colonne) {
    if (this.finie || this.tour !== siege) return null;
    const v = this.des[siege];
    if (v === null) return null;
    if (!Number.isInteger(colonne) || colonne < 0 || colonne >= R.COLUMNS) return null;
    if (R.isColumnFull(this.grilles[siege], colonne)) return null;
    /* ⛔ MEME REGLE QU'EN LIGNE : une colonne gelee refuse le de. Sans elle, le
       telephone accepterait une pose que le serveur rejettera au moment de
       verifier, et la partie honnete serait refusee au retour du reseau. */
    if (this.geleCol[siege] === colonne) return null;

    this.noter({ t: 'pose', s: siege, c: colonne, v });
    const mis = R.place(this.grilles[siege], colonne, v);
    this.grilles[siege] = mis.grid;
    this.des[siege] = null;

    const fx = [{ kind: 'place', seat: siege, cell: mis.cell, value: v }];
    const avantEcart = R.totalScore(this.grilles[siege], opts(this, siege))
                     - R.totalScore(this.grilles[1 - siege], opts(this, 1 - siege));
    const touche = R.destroyMatching(this.grilles[siege], this.grilles[1 - siege]);
    if (touche.destroyed.length) {
      this.grilles[1 - siege] = touche.grid;
      fx.push({ kind: 'destroy', seat: 1 - siege, cells: touche.destroyed });
      if (touche.destroyed.length >= 2) {
        fx.push({ kind: 'broadside', seat: siege, count: touche.destroyed.length });
      }
    }

    /* ⛔ PERSONNE NE PARLAIT HORS LIGNE. Le moteur de poche posait les des et
       rien d'autre : ni pique sur une bordee, ni mot quand l'adversaire repasse
       devant. « Les dialogues de l'IA ou du joueur adverse ne se declenchent
       plus » — ils ne s'etaient jamais declenches ici, et le serveur ayant ete
       injoignable une bonne partie de la journee, c'est ce moteur-la qui jouait.

       ⚠️ LE TIRAGE SE FAIT AVEC `Math.random`, PAS AVEC LA GRAINE. Le hasard de
       la partie est un CONTRAT : le serveur rejoue le journal avec la meme
       graine pour verifier. Consommer un tirage de plus pour choisir une
       replique decalerait tous les des suivants, et chaque partie honnete serait
       refusee au retour du reseau. Le bavardage n'est pas journalise : il peut
       donc tirer ailleurs. */
    const emportes = touche.destroyed.length;
    const apresEcart = R.totalScore(this.grilles[siege], opts(this, siege))
                     - R.totalScore(this.grilles[1 - siege], opts(this, 1 - siege));
    const pique = this.parler(siege, emportes >= 2 ? 'broadside'
      : (emportes === 1 ? 'sting'
        : (avantEcart < 0 && apresEcart > 0 ? 'lead' : null)));
    if (pique) fx.push(pique);

    /* ⛔ `&&` LA OU LE SERVEUR ECRIT `||`, ET LA PARTIE NE FINISSAIT JAMAIS.
       Le serveur s'arrete des qu'UN plateau est plein (`match.js` : « isFull(0)
       || isFull(1) ») ; ce moteur-ci attendait que les DEUX le soient. Or ils ne
       se remplissent presque jamais ensemble : la destruction vide la grille
       d'en face a chaque coup. Le joueur dont le plateau se remplissait le
       premier n'avait alors plus aucun coup legal — `poser` refusait ses quatre
       colonnes, `tourDeLaMachine` rendait null, et rien ne denouait : le mode
       hors ligne n'a pas de pendule, et `dice_solo.js` avale un refus en
       silence. Ecran fige, sans verdict et sans sortie autre que quitter — ce
       qui perd le jeton.

       Mesure au banc, 5 000 graines en configuration de production : 27,7 % des
       parties sans effets et 33,4 % avec. Une partie sur trois. Dans 589 cas
       figes sur 589 examines, exactement UN plateau etait plein.

       ⚠️ Les deux moteurs doivent produire la MEME suite de coups — c'est
       l'en-tete de ce fichier qui le dit, et c'est ce dont depend la
       verification au retour du reseau. Une condition de fin qui differe est
       une divergence comme une autre. */
    if (R.isFull(this.grilles[0]) || R.isFull(this.grilles[1])) this.finie = true;
    else this.passerLaMain(siege, fx);
    return fx;
  }

  /**
   * RENDRE LA MAIN — le seul endroit ou le tour change.
   *
   * ⚠️ TOUT CE QUI APPARTIENT AU TOUR SE CONSOMME ICI, comme sur le serveur : le
   * gel de colonne ne vaut que pour le tour qui vient de s'ecouler, et un tour
   * vole rend la main a celui qui l'a pris. Les deux moteurs doivent produire la
   * MEME suite de coups, sinon la verification rejette une partie honnete.
   */
  passerLaMain(siege, fx) {
    this.geleCol[siege] = -1;
    const victime = 1 - siege;
    if (this.gele[victime]) {
      this.gele[victime] = false;
      this.noter({ t: 'saut', s: victime, par: 'gel' });
      if (fx) fx.push({ kind: 'frozen', seat: victime, by: siege });
      return;                                   // la main REVIENT a celui qui a gele
    }
    this.tour = victime;
  }

  /**
   * Jouer un effet. Hors ligne, ils sont GRATUITS et limites au meme plafond
   * qu'en ligne : la cale du joueur vit sur le serveur, et la debiter sans lui
   * creerait deux inventaires a reconcilier — exactement le genre de dette qu'on
   * paie au premier conflit.
   */
  effet(siege, identifiant, cellule) {
    if (this.finie || this.tour !== siege) return null;
    /* ⛔ DEUX EFFETS NE SE JOUENT PAS HORS LIGNE, ET C'EST UN CHOIX ASSUME.
       La longue-vue (B004) demande de tirer le de SUIVANT avant qu'il ne soit
       joue : cela casserait l'ordre de consommation du hasard sur lequel repose
       toute la verification, et une partie honnete serait rejetee. Le tour
       rallonge (B008) n'a rien a rallonger — il n'y a pas de pendule sur un
       telephone qui joue seul. Mieux vaut deux effets absents qu'un effet qui
       ment ou qui brule un jeton pour rien ; le ratelier les grise. */
    if (identifiant === 'B004' || identifiant === 'B008') return null;
    if (this.effets[siege].includes(identifiant)) return null;
    if (this.effets[siege].length >= this.maxEffets) return null;

    const fx = [];
    const adverse = 1 - siege;

    if (identifiant === 'B001') {
      if (this.des[siege] === null) return null;
      this.des[siege] = null;
      this.effets[siege].push(identifiant);
      this.noter({ t: 'effet', s: siege, b: identifiant, offert: true });
      return fx.concat(this.lancer(siege) || []);
    }

    if (identifiant === 'B007') {
      if (this.gele[adverse]) return null;
      this.gele[adverse] = true;
      this.effets[siege].push(identifiant);
      this.noter({ t: 'effet', s: siege, b: identifiant, offert: true });
      return [{ kind: 'freeze', seat: siege, victim: adverse }];
    }

    const col = R.columnOf(cellule);
    if (identifiant === 'B002' || identifiant === 'B003') {
      const victime = identifiant === 'B002' ? siege : adverse;
      const res = R.clearCell(this.grilles[victime], cellule);
      if (!res || !res.ok) return null;
      this.grilles[victime] = res.grid;
      fx.push({ kind: 'destroy', seat: victime, cells: [cellule], par: siege });
      if (victime !== siege) {
        const mot = this.parler(siege, 'blast');
        if (mot) fx.push(mot);
      }
    } else if (identifiant === 'B005') {
      if (col < 0 || col >= R.COLUMNS) return null;
      this.boost[siege] = col;
      fx.push({ kind: 'boost', seat: siege, column: col });
    } else if (identifiant === 'B011') {
      if (col < 0 || col >= R.COLUMNS) return null;
      this.maudit[adverse] = col;
      fx.push({ kind: 'maudit', seat: adverse, column: col, by: siege });
    } else if (identifiant === 'B006') {
      if (col < 0 || col >= R.COLUMNS) return null;
      if (this.geleCol[adverse] >= 0) return null;
      if (R.isColumnFull(this.grilles[adverse], col)) return null;
      /* Jamais la derniere colonne jouable : cela figerait la partie. */
      let libres = 0;
      for (let c = 0; c < R.COLUMNS; c++) {
        if (c !== col && !R.isColumnFull(this.grilles[adverse], c)) libres++;
      }
      if (!libres) return null;
      this.geleCol[adverse] = col;
      fx.push({ kind: 'gelcol', seat: adverse, column: col, by: siege });
    } else if (identifiant === 'B009') {
      const troc = R.swapCell(this.grilles[siege], this.grilles[adverse], cellule);
      if (!troc.ok) return null;
      const mien = this.grilles[siege][cellule];
      const sien = this.grilles[adverse][cellule];
      this.grilles[siege] = troc.a;
      this.grilles[adverse] = troc.b;
      fx.push({ kind: 'troc', seat: siege, cell: cellule, mine: sien, theirs: mien });
    } else if (identifiant === 'B010') {
      if (col < 0 || col >= R.COLUMNS) return null;
      let touche = false;
      for (const camp of [0, 1]) {
        const res = R.clearColumn(this.grilles[camp], col);
        if (!res.cells.length) continue;
        this.grilles[camp] = res.grid;
        fx.push({ kind: 'destroy', seat: camp, cells: res.cells, par: siege });
        touche = true;
      }
      if (!touche) return null;
      fx.push({ kind: 'rase', column: col, by: siege });
    } else {
      return null;
    }

    this.effets[siege].push(identifiant);
    this.noter({ t: 'effet', s: siege, b: identifiant, case: cellule, offert: true });
    return fx;
  }

  /** Le tour de la machine, d'un bloc : elle lance puis elle pose. */
  tourDeLaMachine() {
    const siege = 1 - this.moi;
    if (this.finie || this.tour !== siege) return null;
    const fx = this.lancer(siege) || [];
    const col = coupDeLaMachine(this, siege);
    /* Aucune colonne jouable : on rend la main plutot que de figer la table.
       `passerLaMain` consomme au passage ce qui appartient au tour. */
    if (col < 0) { this.passerLaMain(siege, fx); return fx; }
    return fx.concat(this.poser(siege, col) || []);
  }

  /**
   * Une pique, aux memes cadences que le serveur (game/banter.js) : une bordee
   * parle a chaque fois, un de emporte une fois sur trois, et personne ne parle
   * deux fois en moins de deux secondes et demie.
   */
  parler(siege, cle) {
    if (!cle) return null;
    const maintenant = Date.now();
    if (maintenant - (this.dernierePique || 0) < 2600) return null;
    const chance = { broadside: 1, sting: 0.34, blast: 0.8, lead: 0.6 }[cle] || 1;
    if (Math.random() >= chance) return null;
    this.dernierePique = maintenant;
    return { kind: 'taunt', seat: siege, key: cle, line: Math.floor(Math.random() * 4) };
  }

  /** Le verdict, quand les deux plateaux sont pleins. */
  verdict() {
    const s = (i) => ({ quarters: this.quarts, boost: this.boost[i], curse: this.maudit[i] });
    const totaux = [R.totalScore(this.grilles[0], s(0)), R.totalScore(this.grilles[1], s(1))];
    const a = totaux[this.moi];
    const b = totaux[1 - this.moi];
    return {
      outcome: a > b ? 'win' : (a < b ? 'loss' : 'draw'),
      scores: [a, b],
      totaux,
    };
  }
}
