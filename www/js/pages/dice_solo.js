/* ============================================================================
   pages/dice_solo.js — LE SERVEUR DE POCHE, POUR JOUER SANS RESEAU.

   ⚠️ L'ECRAN DE JEU NE SAIT PAS QU'IL EST HORS LIGNE, ET C'EST LE POINT. Il
   envoie `roll`, `place`, `bonus`, `cell` a `S.net` et attend des messages
   `state` et `over` en retour. On lui donne donc un objet qui parle exactement
   la meme langue, mais qui repond depuis le telephone. Pas une ligne de
   dice_match.js ne change — et c'est ce qui garantit que la partie hors ligne
   se joue, s'anime et sonne comme les autres.

   ⛔ CE FAUX SERVEUR N'ACCORDE RIEN. Il fait tourner la partie ; le score, les
   pieces et les hauts faits ne deviennent vrais qu'apres verification par le
   VRAI serveur, au retour. Voir dice_horsligne.js pour le contrat de tirage et
   dice-server/src/game/horsligne.js pour la verification.

   ⚠️ ET LA MACHINE PREND SON TEMPS. Elle pourrait repondre en une
   milliseconde ; un adversaire qui joue instantanement donne l'impression d'un
   jeu qui triche, ou qui n'a pas compris qu'on venait de jouer. Le meme delai
   qu'en ligne, et la partie se lit pareil.
   ============================================================================ */

import { PartieHorsLigne } from './dice_horsligne.js';

/* ⚠️ LA MEME TABLE QUE `needsCell` DANS src/game/bonus.js, COTE SERVEUR. Le
   moteur de poche n'a pas acces au catalogue du serveur — il tourne sans
   reseau, c'est tout son objet — mais il doit dire la meme chose. On la garde
   donc courte, nommee, et a un seul endroit : la recopier en ligne dans une
   condition est exactement ce qui l'a laissee prendre trois versions de retard.
   Les effets qui visent : effacer une de ses cases, un canon, une benediction,
   un gel de colonne, un troc, une bordee, une malediction. */
const A_CIBLE = new Map([
  /*        colonne entiere ?  plateau vise (0 = le sien, 1 = celui d'en face) */
  ['B002', { colonne: false, adverse: false }],   // effacer une de ses cases
  ['B003', { colonne: false, adverse: true }],    // le canon
  ['B005', { colonne: true, adverse: false }],    // la benediction
  ['B006', { colonne: true, adverse: true }],     // le gel de colonne
  ['B009', { colonne: false, adverse: false }],   // le troc de des face a face
  ['B010', { colonne: true, adverse: false }],    // la bordee, les deux colonnes
  ['B011', { colonne: true, adverse: true }],     // la malediction
  /* ⚠️ LE SECOND LOT, ET DEUX D'ENTRE EUX VISENT DEUX FOIS. `deux: true` dit
     que l'effet demande une PREMIERE colonne avant la seconde : le serveur de
     poche retient la premiere et ne joue l'effet qu'a la seconde, exactement
     comme `Match.pickCell`. Sans cela, la manoeuvre partirait avec une seule
     colonne, le moteur rendrait null, et le joueur verrait un jeton mort.
     Le brouillard (B013) ne vise rien : il n'est pas dans cette table. Le de
     pipe (B012) non plus — il vise une VALEUR, et passe par `face`. */
  ['B014', { colonne: true, adverse: false, deux: true }],  // la manoeuvre de pont
  ['B015', { colonne: false, adverse: false }],             // la coque renforcee
  ['B016', { colonne: true, adverse: false, deux: true }],  // le changement de quart
]);

const PAUSE_MACHINE = 900;

export class ServeurDePoche {
  constructor(partie, handlers) {
    this.partie = partie;
    this.on = handlers || {};
    this.horloges = new Set();
    this.mort = false;
    /* L'effet arme, et la PREMIERE colonne d'une visee en deux temps. Les deux
       vivent ici et non dans le moteur : viser est un etat d'ecran (voir
       `avecVisee`), et le moteur ne connait pas d'effet a moitie joue. */
    this.enAttente = null;
    this.premiere = null;
  }

  /** Toujours pret : il n'y a pas de socket a attendre. */
  get ready() { return !this.mort; }

  fermer() {
    this.mort = true;
    for (const h of this.horloges) clearTimeout(h);
    this.horloges.clear();
  }

  plusTard(fn, ms) {
    const h = setTimeout(() => { this.horloges.delete(h); if (!this.mort) fn(); }, ms);
    this.horloges.add(h);
    return h;
  }

  /** Diffuser l'etat, comme le ferait le serveur apres chaque coup. */
  pousser(fx) {
    if (this.mort || !this.on.state) return;
    this.on.state({ t: 'state', state: this.avecVisee(), fx: fx || [] });
  }

  /**
   * L'instantane du moteur, plus l'effet en train de viser.
   *
   * ⛔ SANS CE CHAMP, AUCUN EFFET A CIBLE N'ETAIT JOUABLE HORS LIGNE. Le moteur
   * publiait `pending: null` en dur : l'ecran de jeu ne sait pas qu'on vise, et
   * c'est LUI qui decide si un clic sur une case compte. `dice_match.js` sort
   * des la premiere ligne — « if (!pending || pending.seat !== S.seat) return »
   * — donc le clic ne partait jamais, et le gobelet relançait les des au lieu de
   * desarmer. L'effet restait arme jusqu'a la fin de la partie, sans rien faire
   * et sans le dire. Sept effets sur onze, muets, hors ligne.
   *
   * ⚠️ CE CHAMP N'EST PAS DANS LE MOTEUR, ET IL NE DOIT PAS Y ETRE. Le moteur
   * prend la case en ARGUMENT de `effet()` : il n'a pas d'effet a moitie joue, et
   * son instantane est aussi ce que le verificateur du serveur rejoue. Viser est
   * un etat d'ECRAN, il vit donc dans la couche qui parle a l'ecran — ici.
   */
  avecVisee() {
    const st = this.partie.instantane();
    const spec = this.enAttente ? A_CIBLE.get(this.enAttente) : null;
    if (spec) {
      st.pending = {
        seat: this.partie.moi,
        target: spec.adverse ? 1 - this.partie.moi : this.partie.moi,
        column: spec.colonne,
        /* ⚠️ LES TROIS CHAMPS QUE L'ECRAN LIT DEPUIS B012-B016, et il les lit
           SANS savoir s'il parle a un serveur ou a ce moteur de poche : c'est
           tout l'objet de cette couche. `identify` nomme l'etape en cours,
           `premiere` marque la colonne deja designee, `faces` reste nul —
           un effet a cible n'en propose pas. */
        identify: this.enAttente,
        premiere: this.premiere === null || this.premiere === undefined
          ? null : this.premiere,
        faces: null,
      };
    } else if (this.enAttente === 'B012') {
      /* Le de pipe ne vise pas une case : il n'est pas dans `A_CIBLE`, et son
         attente se decrit par les deux valeurs qu'il propose. */
      st.pending = {
        seat: this.partie.moi,
        target: this.partie.moi,
        column: false,
        identify: 'B012',
        premiere: null,
        faces: this.partie.facesPossibles(this.partie.moi),
      };
    }
    return st;
  }

  /** Le message que le jeu attend a la fin d'une partie. */
  conclure() {
    const v = this.partie.verdict();
    if (this.on.over) {
      this.on.over({
        t: 'over',
        reason: 'complete',
        outcome: v.outcome,
        scores: v.scores,
        opponent: 'IA',
        mode: 'solo',
        rated: false,
        ratedWhy: 'solo',
        ratingBefore: 0, ratingAfter: 0,
        coinDelta: 0, orSucces: 0, maudits: 0, objets: [], succes: [],
        opponentCaptain: this.partie.capitaines[1 - this.partie.moi],
        state: this.partie.instantane(),
        /* ⚠️ CE DRAPEAU CHANGE CE QUE LA CARTE DE FIN A LE DROIT DE PROMETTRE.
           Hors ligne, rien n'est acquis tant que le serveur n'a pas verifie : la
           carte doit le dire, pas annoncer des pieces qu'on n'a pas. */
        horsLigne: true,
      });
    }
  }

  /** Le tour de la machine, avec le temps qu'il faut pour qu'on le voie. */
  faireJouerLaMachine() {
    if (this.mort || this.partie.finie) return;
    if (this.partie.tour === this.partie.moi) return;
    this.plusTard(() => {
      const fx = this.partie.tourDeLaMachine();
      this.pousser(fx || []);
      if (this.partie.finie) this.plusTard(() => this.conclure(), 700);
      else this.faireJouerLaMachine();
    }, PAUSE_MACHINE);
  }

  /**
   * La meme porte que le vrai serveur. Tout ce que l'ecran envoie passe par
   * ici, et rien d'autre n'a besoin de savoir ou l'on joue.
   */
  send(msg) {
    if (this.mort || !msg) return false;
    const moi = this.partie.moi;

    switch (msg.t) {
      case 'roll': {
        const fx = this.partie.lancer(moi);
        if (fx) this.pousser(fx);
        return true;
      }
      case 'place': {
        const fx = this.partie.poser(moi, msg.column);
        if (!fx) return true;
        /* ⚠️ LA VISEE NE SURVIT PAS AU TOUR. Le vrai serveur efface `pending`
           dans `passerLaMain` ; ici elle restait armee pendant tout le tour de
           la machine, et le plateau refusait le de au retour. */
        this.enAttente = null;
        this.premiere = null;
        this.pousser(fx);
        if (this.partie.finie) this.plusTard(() => this.conclure(), 700);
        else this.faireJouerLaMachine();
        return true;
      }
      case 'bonus': {
        /* ⛔ QUATRE EFFETS SUR SEPT PARTAIENT SANS LEUR CIBLE. Cette liste
           nommait trois effets — B002, B003, B005 — et elle datait d'un temps ou
           il n'y en avait que six. Les quatre ajoutes depuis (B006, B009, B010,
           B011) visent eux aussi une case ou une colonne : ils partaient donc
           avec `null`, le moteur appliquait `columnOf(null)` — c'est-a-dire la
           colonne 0, pas celle qu'on avait visee — et le journal notait
           `case: null`.
           Au retour du reseau, le verificateur refusait alors la partie ENTIERE :
           « gel sans colonne », « troc sans case », « bordee sans colonne »,
           « malediction sans colonne ». Mesure au banc : 167 parties ou l'un de
           ces effets avait pris, 167 refusees, zero acceptee. Le joueur perdait
           tout ce qu'il avait gagne, sans savoir pourquoi.

           ⚠️ LA LISTE EST REMONTEE EN HAUT DU FICHIER, SOUS UN NOM. Elle reste
           une copie — ce moteur tourne sans reseau, il ne peut pas lire le
           catalogue du serveur — mais une copie qu'on voit. Ecrite en ligne dans
           une condition, au milieu d'une methode de deux cents lignes, elle a
           pris trois versions de retard sans que personne la croise. Le douzieme
           effet s'ajoute a `A_CIBLE`, et `contrat_horsligne.test.js` le dit tout
           de suite si on l'oublie. */
        /* ⛔ ET UN JETON DEJA DEPENSE ARMAIT UNE VISEE FANTOME. Rien ici ne
           demandait si l'effet etait encore jouable : le plateau passait en
           cible, les colonnes cessaient d'accepter le de — `dice_match.js` sort
           tant que `pending` est pose — et il fallait deviner le gobelet pour en
           sortir. Le vrai serveur, lui, REFUSE avant d'armer et renvoie sa
           raison, que l'ecran affiche. On refuse aux memes conditions que le
           moteur, en silence comme lui : c'est le ratelier qui grise. */
        if (!this.partie.peutJouer(moi, msg.identify)) { this.pousser([]); return true; }
        /* Le de pipe vise une VALEUR : on arme, l'ecran propose ses deux faces,
           et `face` conclut. Meme chemin que `pickFace` sur le serveur. */
        if (msg.identify === 'B012') {
          this.enAttente = msg.identify;
          this.premiere = null;
          this.pousser([]);
          return true;
        }
        if (A_CIBLE.has(msg.identify)) {
          this.enAttente = msg.identify;
          this.premiere = null;
          this.pousser([]);
          return true;
        }
        const fx = this.partie.effet(moi, msg.identify, null);
        this.pousser(fx || []);
        return true;
      }
      case 'face': {
        /* ⚠️ LE MOTEUR REVALIDE, ET C'EST LUI QUI TRANCHE. L'ecran ne propose
           que deux faces, mais ce n'est pas l'ecran qui fait la regle : le
           serveur de poche refuse comme le vrai refuserait, et le verificateur
           du serveur relira le journal de toute facon. */
        if (this.enAttente !== 'B012') return true;
        const fx = this.partie.effetFace(moi, 'B012', msg.face);
        if (fx) { this.enAttente = null; this.premiere = null; }
        this.pousser(fx || []);
        return true;
      }
      case 'cell': {
        if (!this.enAttente) return true;
        /* ⚠️ PREMIER TEMPS D'UNE VISEE EN DEUX TEMPS : rien n'est joue, on
           retient la colonne et on repeint pour que l'ecran la marque. Le
           moteur, lui, ne connait pas d'effet a moitie joue — c'est ici que
           l'etat intermediaire vit, exactement comme `pending.premiere` cote
           serveur. */
        const forme = A_CIBLE.get(this.enAttente);
        if (forme && forme.deux && this.premiere === null) {
          this.premiere = msg.cell;
          this.pousser([]);
          return true;
        }
        const fx = this.partie.effet(moi, this.enAttente, msg.cell, this.premiere);
        /* ⚠️ UNE CASE REFUSEE NE DESARME PAS L'EFFET. C'est ce que fait le vrai
           serveur — « `pending` reste POSE : l'effet demeure arme, on vise
           ailleurs ». Le desarmer ici obligeait a rouvrir la cale et a recliquer
           le jeton apres chaque case invalide, alors qu'en ligne on vise
           simplement a cote. Le bouton du gobelet reste la sortie. */
        if (fx) this.enAttente = null;
        this.pousser(fx || []);
        return true;
      }
      case 'unbonus':
        this.enAttente = null;
        this.premiere = null;
        this.pousser([]);
        return true;
      case 'leave':
        /* ⛔ QUITTER UNE PARTIE HORS LIGNE NE L'ENVOIE PAS AU SERVEUR. Elle n'a
           pas ete jouee jusqu'au bout, donc elle ne rapporterait rien — et son
           jeton est perdu, exactement comme une table quittee en ligne. */
        this.fermer();
        if (this.on.idle) this.on.idle({ t: 'idle' });
        return true;
      case 'ping':
      case 'refresh':
      case 'mood':
        return true;
      default:
        return true;
    }
  }
}

/** Ouvrir une partie hors ligne et rendre le faux serveur qui la porte. */
export function ouvrirPartieHorsLigne(config, handlers) {
  const partie = new PartieHorsLigne(config);
  const poche = new ServeurDePoche(partie, handlers);
  /* Le message d'ouverture, dans la forme exacte que l'ecran attend. */
  if (handlers.match) {
    handlers.match({ t: 'match', seat: partie.moi, mode: 'solo', state: partie.instantane() });
  }
  poche.faireJouerLaMachine();
  return poche;
}
