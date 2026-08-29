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
  return { quarters: etat.quarts, boost: etat.boost[siege] };
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
    this.effets = [[], []];
    this.gratuitUtilise = [false, false];
    this.tour = 0;
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
    const s = (i) => ({ quarters: this.quarts, boost: this.boost[i] });
    return {
      matchId: 'hors-ligne',
      captains: this.capitaines.slice(),
      traits: [null, null],
      freeReroll: [0, 0],
      freeBonus: [null, null],
      gele: [false, false],
      /* ⚠️ TROIS CHAMPS QUI VALENT TOUJOURS « RIEN », ET QUI DOIVENT QUAND MEME
         ETRE LA. Le mode hors ligne n'a ni capitaines ni effets — `traits` et
         `freeBonus` sont deja nuls plus haut pour la meme raison. Mais l'ecran
         de jeu est le MEME code : `renderGel` et `renderMaudit` lisent ces
         champs a chaque instantane. Les omettre marche par accident (les gardes
         `st.geleCol ? … : -1` retombent sur rien), et un accident qui marche est
         une panne qui attend. On declare la forme entiere. */
      geleCol: [-1, -1],
      maudCol: [-1, -1],
      tourLong: [false, false],
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

    this.noter({ t: 'pose', s: siege, c: colonne, v });
    const mis = R.place(this.grilles[siege], colonne, v);
    this.grilles[siege] = mis.grid;
    this.des[siege] = null;

    const fx = [{ kind: 'place', seat: siege, cell: mis.cell, value: v }];
    const touche = R.destroyMatching(this.grilles[siege], this.grilles[1 - siege]);
    if (touche.destroyed.length) {
      this.grilles[1 - siege] = touche.grid;
      fx.push({ kind: 'destroy', seat: 1 - siege, cells: touche.destroyed });
      if (touche.destroyed.length >= 2) {
        fx.push({ kind: 'broadside', seat: siege, count: touche.destroyed.length });
      }
    }

    if (R.isFull(this.grilles[0]) && R.isFull(this.grilles[1])) this.finie = true;
    else this.tour = 1 - siege;
    return fx;
  }

  /**
   * Jouer un effet. Hors ligne, ils sont GRATUITS et limites au meme plafond
   * qu'en ligne : la cale du joueur vit sur le serveur, et la debiter sans lui
   * creerait deux inventaires a reconcilier — exactement le genre de dette qu'on
   * paie au premier conflit.
   */
  effet(siege, identifiant, cellule) {
    if (this.finie || this.tour !== siege) return null;
    if (identifiant === 'B004') return null;            // la longue-vue n'existe pas ici
    if (this.effets[siege].includes(identifiant)) return null;
    if (this.effets[siege].length >= this.maxEffets) return null;

    const fx = [];
    if (identifiant === 'B001') {
      if (this.des[siege] === null) return null;
      this.des[siege] = null;
      this.effets[siege].push(identifiant);
      this.noter({ t: 'effet', s: siege, b: identifiant, offert: true });
      return fx.concat(this.lancer(siege) || []);
    }
    if (identifiant === 'B002' || identifiant === 'B003') {
      const victime = identifiant === 'B002' ? siege : 1 - siege;
      const res = R.clearCell(this.grilles[victime], cellule);
      if (!res || !res.ok) return null;
      this.grilles[victime] = res.grid;
      fx.push({ kind: 'destroy', seat: victime, cells: [cellule] });
    } else if (identifiant === 'B005') {
      const col = R.columnOf(cellule);
      if (col < 0 || col >= R.COLUMNS) return null;
      this.boost[siege] = col;
      fx.push({ kind: 'boost', seat: siege, column: col });
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
    if (col < 0) { this.tour = this.moi; return fx; }
    return fx.concat(this.poser(siege, col) || []);
  }

  /** Le verdict, quand les deux plateaux sont pleins. */
  verdict() {
    const s = (i) => ({ quarters: this.quarts, boost: this.boost[i] });
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
