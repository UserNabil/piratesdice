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

import { brancherElement, debrancherElement, niveauElement, fondre, reveiller, dormir } from './bus_audio.js';

/**
 * ⛔ `audio.loop = true` NE BOUCLE PAS SANS TROU DANS WKWEBVIEW. Mesure faite
 * dans l'application, tampon plein et sans aucun deplacement de tete de
 * lecture : au moment de reboucler, le lecteur se tait ~450 ms et
 * `currentTime` reste colle a 0. Ce n'est donc ni un defaut de fichier ni un
 * probleme d'encodage — les pistes portent bien leur atome `iTunSMPB` — c'est
 * le lecteur qui s'arrete pour repartir.
 *
 * On ne boucle donc plus : ON PASSE LE RELAIS. Le morceau est coupe a son point
 * de boucle, mais le fichier garde `fondu` secondes de matiere APRES ce point.
 * Arrive la, un second lecteur demarre au debut pendant que le premier finit
 * cette matiere en trop : les deux se croisent, l'un descend, l'autre monte. Ce
 * qu'on entend est exactement le raccord voulu — et le calage du lecteur, lui,
 * se produit dans le silence d'une piste qui n'est pas encore montee.
 *
 * `fondu` est la SEULE donnee a garder d'accord avec les fichiers : le point de
 * boucle s'en deduit (`duree - fondu`), donc reencoder une piste plus longue ou
 * plus courte ne demande rien ici.
 */
const PISTES = {
  menu: [{ f: 'music_menu.m4a', fondu: 1.6 }],
  partie: [{ f: 'music_game_01.m4a', fondu: 2.0 }],
};

/**
 * ⛔ AUCUNE MUSIQUE NE COMMENCE NI NE S'ARRETE NET. Une piste qui part d'un coup
 * s'entend comme une faute technique, meme quand elle est juste ; une piste
 * coupee au milieu d'une mesure s'entend comme un plantage. Toutes les entrees
 * et sorties passent donc par un fondu, y compris quand on passe du pont a
 * l'arene : les deux se croisent, l'une descend pendant que l'autre monte.
 *
 * Les durees ne sont pas au hasard : 1,4 s couvre un peu plus d'une mesure des
 * deux morceaux (1,6 s a trois temps pour le pont, 2 s a quatre pour l'arene),
 * assez pour que l'oreille suive la bascule sans la vivre comme un evenement.
 * La coupure de fin de partie est plus courte — la fanfare de victoire arrive
 * derriere, et on ne la fait pas attendre.
 */
const FONDU = { croise: 1.4, coupe: 0.55, retour: 0.4 };

/* Assez fort pour exister, assez bas pour laisser passer les des et les voix :
   la musique ne doit jamais couvrir le claquement du de, qui est
   l'information la plus utile du jeu.

   ⚠️ CES DEUX NOMBRES DEPENDENT DES FICHIERS, PAS DU GOUT. Les pistes de
   l'admin sont masterisees plus bas que les placeholders qu'elles remplacent —
   4,8 dB pour le pont, 1,4 dB pour l'arene sur les passages forts, mesure faite
   fichier contre fichier. Garder 0,34 et 0,22 aurait donc rendu la musique
   nettement plus discrete qu'avant sans que personne n'ait rien demande. Les
   valeurs sont relevees d'autant : le melange entendu reste celui qui avait ete
   regle. Toute nouvelle piste demande la meme mesure. */
const VOLUME = { menu: 0.60, partie: 0.26 };

export class Musique {
  constructor(base) {
    this.base = base;
    this.muette = false;
    this.dehors = false;
    this.scene = null;          // 'menu' | 'partie'
    this.audio = null;
    this.tour = 0;              // quelle piste de partie on a jouee en dernier
    this.piste = null;          // la piste en cours, avec sa duree de fondu
    this.suivant = null;        // le lecteur prepare pour le tour suivant
    this.horloge = null;        // la surveillance du point de boucle
    this.minuteur = null;       // le rendez-vous precis
    this.jusqua = 0;            // jusqu'a quand un fondu est en cours
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
    this.piste = piste;
    /* ⚠️ LA SORTANTE PART EN FONDU PENDANT QUE L'ENTRANTE MONTE. Elle n'est
       donc pas arretee ici : elle continue de jouer une seconde et demie, sans
       plus appartenir a l'objet. C'est ce croisement qui fait la douceur — un
       `arreter()` sec suivi d'un depart, c'est exactement le contraire. */
    this.eteindre(FONDU.croise);
    this.scene = scene;
    try {
      const audio = this.ouvrir(piste);
      this.audio = audio;
      /* ⛔ LE NIVEAU PASSE PAR LE BUS, PAS PAR `volume`. Voir ui/bus_audio.js :
         sur iOS la propriete est stockee puis ignoree, et le curseur du joueur
         n'avait aucun effet audible. */
      this.gain = brancherElement(audio, 'musique');
      audio.volume = this.gain ? 1 : this.niveauReel();
      /* Entree en fondu depuis le silence, toujours. */
      this.appliquerNiveau(FONDU.croise, 0);
      this.jusqua = Date.now() + FONDU.croise * 1000;
      if (!this.muette && !this.dehors && this.niveau) this.essayerDeJouer();
      this.armerLeRelais();
    } catch (_) { this.audio = null; }
  }

  /** Un lecteur pret a jouer une piste, branche sur le bus. */
  ouvrir(piste) {
    const audio = new Audio(this.base + piste.f);
    /* Pas de `loop` : c'est justement lui qui fait le trou. Le relais s'en
       charge, et `ended` sert de filet si le rendez-vous avait ete manque
       (telephone qui rame, onglet endormi). */
    audio.loop = false;
    audio.preload = 'auto';
    return audio;
  }

  /**
   * Guetter le point de boucle et passer le relais.
   *
   * ⚠️ ON NE SURVEILLE PAS A 50 ms PENDANT DEUX MINUTES. Le rendez-vous doit
   * etre pris a quelques dizaines de millisecondes pres, mais une horloge qui
   * bat tout le temps coute de la batterie pour rien. On regarde donc de loin,
   * puis on pose un reveil precis quand l'echeance approche.
   */
  armerLeRelais() {
    this.desarmerLeRelais();
    const audio = this.audio;
    const piste = this.piste;
    if (!audio || !piste) return;
    const guetter = () => {
      if (this.audio !== audio) return;
      const duree = audio.duration;
      if (!duree || !isFinite(duree)) return;             // metadonnees pas encore la
      const relais = Math.max(0.1, duree - piste.fondu);
      const reste = relais - audio.currentTime;
      if (reste <= 0.25) {
        this.desarmerLeRelais();
        this.minuteur = setTimeout(() => this.passerLeRelais(), Math.max(0, reste * 1000));
      } else if (reste <= 4 && !this.suivant) {
        /* Le suivant s'ouvre a l'avance : un lecteur cree au dernier moment
           passe son temps de demarrage a l'ecran, c'est-a-dire dans le fondu. */
        this.suivant = this.ouvrir(piste);
        try { this.suivant.load(); } catch (_) { /* tant pis, il chargera seul */ }
      }
    };
    this.horloge = setInterval(guetter, 200);
    audio.addEventListener('ended', () => { if (this.audio === audio) this.passerLeRelais(); }, { once: true });
  }

  desarmerLeRelais() {
    if (this.horloge) { clearInterval(this.horloge); this.horloge = null; }
    if (this.minuteur) { clearTimeout(this.minuteur); this.minuteur = null; }
  }

  /** Le second lecteur prend la main ; le premier finit sa queue et s'efface. */
  passerLeRelais() {
    const piste = this.piste;
    const ancien = this.audio;
    const ancienGain = this.gain;
    if (!piste || !ancien) return;
    this.desarmerLeRelais();
    let neuf = this.suivant;
    this.suivant = null;
    try {
      if (!neuf) neuf = this.ouvrir(piste);
      neuf.currentTime = 0;
      const gain = brancherElement(neuf, 'musique');
      neuf.volume = gain ? 1 : 0;
      this.audio = neuf;
      this.gain = gain;
      const cible = this.muette ? 0 : (VOLUME[this.scene] || 0.25);
      if (gain) fondre(gain, 0, cible, piste.fondu);
      else this.echelonner(neuf, 0, cible, piste.fondu);
      this.jusqua = Date.now() + piste.fondu * 1000;
      const p = neuf.play();
      if (p && p.catch) p.catch(() => { /* refuse : rien de grave, la piste reste muette */ });
      /* L'ancien finit la matiere qui suit le point de boucle, en descendant. */
      if (ancienGain) fondre(ancienGain, cible, 0, piste.fondu);
      else this.echelonner(ancien, ancien.volume, 0, piste.fondu);
      setTimeout(() => {
        try { ancien.pause(); ancien.currentTime = 0; } catch (_) { /* deja */ }
        debrancherElement(ancien);
      }, Math.round(piste.fondu * 1000) + 80);
      this.armerLeRelais();
    } catch (_) { /* on garde l'ancien plutot que de tomber muet */ }
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
  appliquerNiveau(secondes, depuis) {
    const cible = this.muette ? 0 : (VOLUME[this.scene] || 0.25);
    if (this.gain) {
      if (secondes) fondre(this.gain, depuis === undefined ? cible : depuis, cible, secondes);
      else niveauElement(this.gain, cible);
      return;
    }
    /* Chemin de secours (pas de Web Audio) : on echelonne a la main. Sur iOS ce
       chemin ne s'entend pas — `volume` y est ignore — mais ailleurs il evite
       une entree brutale. */
    if (!this.audio) return;
    if (!secondes) { try { this.audio.volume = this.niveauReel(); } catch (_) { /* pas de son */ } return; }
    this.echelonner(this.audio, depuis === undefined ? this.niveauReel() : depuis, this.niveauReel(), secondes);
  }

  /** Un fondu au pas a pas, pour le chemin sans Web Audio. */
  echelonner(element, depart, arrivee, secondes, fin) {
    if (this.pas) { clearInterval(this.pas); this.pas = null; }
    const N = Math.max(2, Math.round(secondes * 30));
    let i = 0;
    const tic = setInterval(() => {
      i += 1;
      const u = i / N;
      try { element.volume = Math.min(1, Math.max(0, Math.sqrt(depart * depart * (1 - u) + arrivee * arrivee * u))); }
      catch (_) { /* pas de son */ }
      if (i >= N) { clearInterval(tic); if (this.pas === tic) this.pas = null; if (fin) fin(); }
    }, Math.round(secondes * 1000 / N));
    this.pas = tic;
  }

  /**
   * Faire sortir la piste courante en fondu et la lacher. L'objet ne la
   * possede plus : elle finit de descendre toute seule, puis se tait.
   */
  eteindre(secondes) {
    const audio = this.audio;
    const gain = this.gain;
    this.desarmerLeRelais();
    if (this.suivant) { try { this.suivant.pause(); } catch (_) { /* jamais joue */ } this.suivant = null; }
    this.audio = null;
    this.gain = null;
    if (!audio) return;
    const finir = () => {
      try { audio.pause(); audio.currentTime = 0; } catch (_) { /* deja */ }
      debrancherElement(audio);
    };
    if (gain) {
      fondre(gain, this.muette ? 0 : (VOLUME[this.scene] || 0.25), 0, secondes);
      setTimeout(finir, Math.round(secondes * 1000) + 60);
      return;
    }
    this.echelonner(audio, audio.volume, 0, secondes, finir);
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
    const avant = this.niveau;
    this.niveau = Number.isFinite(f) && f > 0 ? f : 0;
    if (!this.audio) return;
    /* Le curseur du joueur agit sur le gain du CANAL, deja lisse la-bas : ici
       on ne fait que suivre l'etat courant, sans fondu supplementaire.
       ⛔ ET ON NE RAPPELLE `reprendre()` QUE SI ON REVENAIT DE ZERO. Il refait
       une entree en fondu depuis le silence : appele a chaque cran du curseur,
       il coupait la musique et la remontait a chaque pixel de glissement, et il
       effacait au passage le fondu enchaine en cours. */
    if (!this.niveau) { this.appliquerNiveau(); this.suspendre(); return; }
    if (!avant) this.reprendre();
    else if (!this.enFondu()) this.appliquerNiveau();
  }

  /** Vrai tant qu'un fondu enchaine est en cours : on ne le derange pas. */
  enFondu() {
    return !!(this.jusqua && this.jusqua > Date.now());
  }

  get volume() { return this.niveau; }

  suspendre() { if (this.audio) { try { this.audio.pause(); } catch (_) { /* deja */ } } }

  reprendre() {
    if (this.muette || this.dehors || !this.niveau || !this.audio) return;
    /* Retour au premier plan : on remonte depuis le silence, pas d'un bloc. */
    this.appliquerNiveau(FONDU.retour, 0);
    /* ⚠️ LE BUS DOIT ETRE EVEILLE, SINON LA PISTE JOUE DANS LE VIDE. Un element
       branche sur un contexte endormi ne sort pas du telephone : `play()`
       reussit, et on n'entend rien. */
    reveiller();
    this.essayerDeJouer();
  }

  /**
   * Arreter pour de bon — en fondu, lui aussi.
   *
   * ⚠️ APPELE A LA FIN D'UNE PARTIE, JUSTE AVANT LA FANFARE. Une boucle coupee
   * net a cet instant precis s'entend comme une panne au moment ou le joueur
   * gagne. Un demi-fondu suffit a l'effacer, et il laisse la place au verdict.
   */
  arreter(secondes) {
    if (!this.audio) { this.scene = null; return; }
    this.eteindre(secondes === undefined ? FONDU.coupe : secondes);
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
