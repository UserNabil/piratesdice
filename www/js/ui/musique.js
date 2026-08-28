/* ============================================================================
   ui/musique.js — LA MUSIQUE DE FOND, UN CANAL A PART.

   ⚠️ CE N'EST PAS UN SON DE PLUS. `Sfx` joue des echantillons courts qu'on
   empile ; une musique se joue SEULE, en boucle, et doit survivre au passage
   d'un ecran a l'autre sans repartir du debut. Deux besoins opposes, deux
   objets.

   ⛔ ET LA BOUCLE NE PEUT PAS ETRE UN MP3. Le format ajoute quelques dizaines de
   millisecondes de silence en tete et en queue de chaque fichier (le
   « remplissage » de l'encodeur) : en lecture bouclee, cela s'entend comme un
   hoquet a chaque tour, et il annule tout le travail de raccord fait au
   montage. Les pistes sont donc en AAC (.m4a), ou l'information de decoupe est
   portee par le conteneur.

   ⚠️ TROIS PISTES DE PARTIE, TIREES A TOUR DE ROLE. Une seule boucle de deux
   minutes revient trente fois dans une partie : au dixieme passage on ne
   l'entend plus, au vingtieme elle agace. Alterner ne coute qu'un fichier de
   plus et repousse la lassitude bien plus loin qu'une meilleure composition.

   ⚠️ ET ELLE SE TAIT QUAND L'APPLICATION PASSE DERRIERE, comme les effets : un
   jeu qui continue de jouer depuis l'ecran d'accueil du telephone est un jeu
   qu'on desinstalle.
   ============================================================================ */

import { brancherElement, debrancherElement, niveauElement, reveiller, dormir } from './bus_audio.js';

const PISTES = {
  menu: ['music_menu.m4a'],
  partie: ['music_game_01.m4a', 'music_game_02.m4a', 'music_game_03.m4a'],
};

/* Assez fort pour exister, assez bas pour laisser passer les des et les voix.
   Mesure a l'oreille sur haut-parleur de telephone : au-dela de 0,3 la musique
   couvre le claquement du de, qui est l'information la plus utile du jeu. */
const VOLUME = { menu: 0.34, partie: 0.22 };

export class Musique {
  constructor(base) {
    this.base = base;
    this.muette = false;
    this.dehors = false;
    this.scene = null;          // 'menu' | 'partie'
    this.audio = null;
    this.tour = 0;              // quelle piste de partie on a jouee en dernier
    /* ⚠️ LE NIVEAU DU JOUEUR, EN FACTEUR SUR LE MELANGE REGLE PLUS BAS. Il peut
       depasser 1 : la musique est volontairement basse pour laisser passer les
       des, et celui qui la veut en avant doit pouvoir la monter au-dessus du
       melange par defaut — sinon le curseur ne sert qu'a l'eteindre. */
    this.niveau = 1;
    /* Le gain de la piste dans le bus. Tant qu'il existe, c'est LUI qui porte
       le niveau : `audio.volume` reste a 1, parce que sur iOS il ne sert a
       rien et qu'ailleurs il ferait une seconde attenuation par-dessus. */
    this.gain = null;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.dehors = document.hidden;
        if (document.hidden) { this.suspendre(); dormir(); }
        else this.reprendre();
      });
    }
  }

  /**
   * Jouer la musique d'une scene. Redemander la MEME scene ne coupe rien :
   * c'est ce qui permet d'appeler cette methode a chaque rendu sans y penser.
   */
  jouer(scene) {
    if (this.scene === scene && this.audio) return;
    const choix = PISTES[scene];
    if (!choix) return;
    /* Une piste differente de la precedente, quand il y en a plusieurs. */
    const piste = choix.length === 1 ? choix[0] : choix[this.tour++ % choix.length];
    this.arreter();
    this.scene = scene;
    try {
      const audio = new Audio(this.base + piste);
      audio.loop = true;
      audio.preload = 'auto';
      this.audio = audio;
      /* ⛔ LE NIVEAU PASSE PAR LE BUS, PAS PAR `volume`. Voir ui/bus_audio.js :
         sur iOS la propriete est stockee puis ignoree, et le curseur du joueur
         n'avait aucun effet audible. */
      this.gain = brancherElement(audio, 'musique');
      audio.volume = this.gain ? 1 : this.niveauReel();
      this.appliquerNiveau();
      if (!this.muette && !this.dehors && this.niveau) this.essayerDeJouer();
    } catch (_) { this.audio = null; }
  }

  /**
   * ⚠️ LE NAVIGATEUR PEUT REFUSER, ET CE N'EST PAS UNE ERREUR. Tant que le
   * joueur n'a pas touche l'ecran, aucune lecture automatique n'est permise. On
   * re-essaie donc au premier geste, une seule fois — et on ne dit rien.
   */
  essayerDeJouer() {
    if (!this.audio) return;
    const p = this.audio.play();
    if (p && p.catch) {
      p.catch(() => {
        if (this.enAttenteDeGeste) return;
        this.enAttenteDeGeste = true;
        const reprendre = () => {
          this.enAttenteDeGeste = false;
          document.removeEventListener('pointerdown', reprendre, true);
          reveiller();
          if (!this.muette && !this.dehors && this.audio) {
            const q = this.audio.play();
            if (q && q.catch) q.catch(() => { /* toujours refuse : on renonce */ });
          }
        };
        document.addEventListener('pointerdown', reprendre, true);
      });
    }
  }

  /** Le volume que doit porter le <audio>, borne : hors de [0,1] il jette. */
  niveauReel() {
    if (this.muette) return 0;
    const cible = (VOLUME[this.scene] || 0.25) * this.niveau;
    return Math.min(1, Math.max(0, cible));
  }

  /**
   * Poser le niveau la ou il agit vraiment.
   *
   * ⚠️ LE GAIN DE LA PISTE NE PORTE QUE LE MELANGE DE LA SCENE (0,34 au pont,
   * 0,22 en partie). Le curseur du joueur, lui, est deja porte par le gain du
   * CANAL, pose une seule fois par `volumes.js` : le multiplier ici aussi
   * l'appliquerait deux fois, et 60 % donnerait 36 %.
   */
  appliquerNiveau() {
    if (this.gain) { niveauElement(this.gain, this.muette ? 0 : (VOLUME[this.scene] || 0.25)); return; }
    if (this.audio) { try { this.audio.volume = this.niveauReel(); } catch (_) { /* pas de son */ } }
  }

  /**
   * Le curseur des reglages, en facteur. On l'applique A CHAUD sur la piste en
   * cours : un reglage de volume qui ne s'entend qu'au morceau suivant ne se
   * regle pas, il se devine. Et a 0 on met en pause plutot que de laisser un
   * fichier de deux minutes tourner en silence — c'est de la batterie pour
   * rien.
   */
  set volume(facteur) {
    const f = Number(facteur);
    this.niveau = Number.isFinite(f) && f > 0 ? f : 0;
    if (!this.audio) return;
    this.appliquerNiveau();
    if (!this.niveau) this.suspendre();
    else this.reprendre();
  }

  get volume() { return this.niveau; }

  suspendre() { if (this.audio) { try { this.audio.pause(); } catch (_) { /* deja */ } } }

  reprendre() {
    if (this.muette || this.dehors || !this.niveau || !this.audio) return;
    /* ⚠️ LE BUS DOIT ETRE EVEILLE, SINON LA PISTE JOUE DANS LE VIDE. Un element
       branche sur un contexte endormi ne sort pas du telephone : `play()`
       reussit, et on n'entend rien. */
    reveiller();
    this.essayerDeJouer();
  }

  arreter() {
    if (!this.audio) return;
    try { this.audio.pause(); this.audio.currentTime = 0; } catch (_) { /* deja */ }
    /* Debrancher : un element laisse dans le graphe n'est jamais ramasse, et on
       en cree un par piste, donc un par partie. */
    debrancherElement(this.audio);
    this.gain = null;
    this.audio = null;
    this.scene = null;
  }

  /** Le meme interrupteur que les effets : un seul reglage pour tout le son. */
  set muted(valeur) {
    this.muette = !!valeur;
    this.appliquerNiveau();
    if (this.muette) this.suspendre();
    else this.reprendre();
  }

  get muted() { return this.muette; }
}
