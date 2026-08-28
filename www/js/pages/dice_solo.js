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

const PAUSE_MACHINE = 900;

export class ServeurDePoche {
  constructor(partie, handlers) {
    this.partie = partie;
    this.on = handlers || {};
    this.horloges = new Set();
    this.mort = false;
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
    this.on.state({ t: 'state', state: this.partie.instantane(), fx: fx || [] });
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
        this.pousser(fx);
        if (this.partie.finie) this.plusTard(() => this.conclure(), 700);
        else this.faireJouerLaMachine();
        return true;
      }
      case 'bonus': {
        /* Les effets a cible attendent la case : on annonce l'attente comme le
           fait le serveur, en poussant simplement l'etat. */
        const aCible = msg.identify === 'B002' || msg.identify === 'B003' || msg.identify === 'B005';
        if (aCible) { this.enAttente = msg.identify; this.pousser([]); return true; }
        const fx = this.partie.effet(moi, msg.identify, null);
        this.pousser(fx || []);
        return true;
      }
      case 'cell': {
        if (!this.enAttente) return true;
        const fx = this.partie.effet(moi, this.enAttente, msg.cell);
        this.enAttente = null;
        this.pousser(fx || []);
        return true;
      }
      case 'unbonus':
        this.enAttente = null;
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
