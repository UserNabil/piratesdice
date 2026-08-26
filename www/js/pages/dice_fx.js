/* ============================================================================
   pages/dice_fx.js — ce que la partie ANNONCE.

   Le serveur envoie une liste d'effets a chaque coup ; la moitie d'entre eux ne
   se dessinent pas, ils se DISENT : un trait de capitaine qui vient de se
   declencher, une bordee, l'IA qui joue un bonus. Sans un mot, le joueur voit
   des des disparaitre sans savoir pourquoi — et un jeu qu'on ne comprend pas
   n'est pas difficile, il est injuste.

   Tout est ici pour que dice_match.js reste le dessin de la table, et parce que
   ces annonces partagent la meme regle : ne jamais parler deux fois du meme
   evenement, et ne jamais couvrir le plateau.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/toast.js';
import { S, ASSETS, bonusArt, skinOf } from './dice_state.js';

/**
 * Combien de temps laisser un message a l'ecran ?
 *
 * ⚠️ UNE DUREE FIXE EST FORCEMENT FAUSSE POUR QUELQU'UN. « Feu ! » et
 * « Tu etais trop a l'aise » ne se lisent pas dans le meme temps, et une valeur
 * unique est soit trop longue pour l'un, soit trop courte pour l'autre — le
 * retour de l'admin portait sur le second cas.
 *
 * On compte donc les caracteres. Le socle couvre le temps de REMARQUER le
 * message : c'est l'essentiel du cout quand on regardait ailleurs. Puis 55 ms
 * par caractere, ce qui correspond a une lecture tranquille de dix-huit signes
 * par seconde — plus lent qu'une lecture attentive, parce qu'on lit d'un oeil.
 * Les bornes evitent les deux extremes : un mot seul reste visible, un pave ne
 * squatte pas l'ecran.
 */
/* ⚠️ RELEVE APRES LA REFONTE : « ca ne s'affiche pas longtemps ». Les repliques
   sont courtes — quatre mots — donc elles tombaient toutes sur le plancher, et
   ce plancher etait cale sur un ecran ou la bulle occupait le haut ou le bas,
   bien en vue. Au milieu de l'ecran, entre deux plateaux qui bougent, il faut
   plus de temps pour la remarquer. */
const LIRE_SOCLE = 2200;
const LIRE_PAR_SIGNE = 55;
const LIRE_MIN = 3200;
const LIRE_MAX = 7000;

function tempsDeLecture(texte) {
  const n = (texte || '').length;
  return Math.max(LIRE_MIN, Math.min(LIRE_MAX, LIRE_SOCLE + n * LIRE_PAR_SIGNE));
}

/**
 * Poser un message : il part de lui-meme, ou des qu'on le touche.
 *
 * ⚠️ « ATTENDRE QUE CA PARTE » EST UNE ATTENTE IMPOSEE. Un joueur qui a lu veut
 * revoir son plateau tout de suite ; sans moyen de chasser le message, la seule
 * option est de patienter devant une phrase deja comprise. Un appui suffit —
 * et comme ces panneaux etaient jusqu'ici transparents aux clics
 * (`pointer-events: none`), il faut le leur rendre explicitement.
 */
function poser(el, texte) {
  el.style.pointerEvents = 'auto';
  el.style.cursor = 'pointer';
  let fini = false;
  const chasser = () => {
    if (fini) return;
    fini = true;
    clearTimeout(minuterie);
    el.classList.add('dc-msg-part');
    /* On laisse le fondu se jouer : retirer le noeud sous le doigt donne
       l'impression d'un raté plutot que d'un geste. */
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 160);
  };
  el.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); chasser(); });
  const minuterie = setTimeout(chasser, tempsDeLecture(texte));
  return chasser;
}

let derniere = 0;

/* Une banniere ne se rejoue pas sur elle-meme : deux coups rapproches se
   voleraient l'affichage, et on ne lirait ni l'un ni l'autre. */
function banner(texte, ton) {
  const arene = document.querySelector('#dc-screen-game .dc-arena');
  if (!arene) return;
  const now = Date.now();
  if (now - derniere < 400) return;
  derniere = now;

  const el = document.createElement('div');
  el.className = 'dc-shout' + (ton ? ' dc-shout-' + ton : '');
  el.textContent = texte;
  arene.appendChild(el);
  poser(el, texte);
}

/** La table tremble : une bordee, ca se sent avant de se lire. */
function shake() {
  const arene = document.querySelector('#dc-screen-game .dc-arena');
  if (!arene) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  arene.classList.remove('dc-shake');
  void arene.offsetWidth;
  arene.classList.add('dc-shake');
  setTimeout(() => arene.classList.remove('dc-shake'), 520);
}

/** La vibration du telephone, quand il en a une. Silencieuse ailleurs. */
function buzz(ms) {
  if (!navigator.vibrate || (S.sfx && S.sfx.muted)) return;
  try { navigator.vibrate(ms); } catch (_) { /* refuse : ce n'est pas grave */ }
}

function nomDuSiege(seat) {
  const p = S.state && S.state.players ? S.state.players[seat] : null;
  return (p && p.name) || t('game.opponent');
}

/* ─────────────────────────────────────────────── la table se parle ─────── */

/**
 * LES CINQ HUMEURS. Le serveur ne connait que leurs NUMEROS : changer un glyphe
 * ici ne perime aucune version de serveur, et aucun texte libre ne circule entre
 * les joueurs — il n'y a donc rien a moderer.
 *
 * Cinq etats qui couvrent ce qu'on ressent a cette table : on se moque, on rage,
 * on encaisse, on salue, on doute. Six en ferait un clavier ; quatre laisserait
 * un trou.
 */
/* ⚠️ C'ETAIENT DES EMOJIS DU SYSTEME, ET ILS NE SE RESSEMBLAIENT NULLE PART.
   Le meme 😱 est bleu sur un iPhone, jaune sur un Pixel et anguleux sur un
   Samsung : deux joueurs voyaient deux humeurs differentes pour un seul geste,
   et aucune des trois n'appartenait au jeu. Ce sont desormais cinq dessins de
   la meme main que le reste — chacun porte encore son glyphe comme secours et
   comme intitule pour qui ecoute l'ecran. */
export const MOODS = [
  { fichier: 'mood_laugh.png', glyphe: '😂' },
  { fichier: 'mood_angry.png', glyphe: '😡' },
  { fichier: 'mood_shocked.png', glyphe: '😱' },
  { fichier: 'mood_good.png', glyphe: '👏' },
  { fichier: 'mood_think.png', glyphe: '🤔' },
];

export function moodArt(i) {
  const m = MOODS[i] || MOODS[0];
  return ASSETS + 'img/' + m.fichier;
}

/* Une humeur dessinee, dans la meme bulle que les repliques. */
function bulleImage(seat, index) {
  const m = MOODS[index] || MOODS[0];
  const img = document.createElement('img');
  img.className = 'dc-mood-art';
  img.src = moodArt(index);
  img.alt = m.glyphe;
  bubble(seat, img, 'dc-bulle-mood');
}

/**
 * Une bulle au-dessus d'un portrait.
 *
 * ⚠️ UNE SEULE BULLE PAR SIEGE A LA FOIS. Sans ce remplacement, deux repliques
 * rapprochees se superposent et deviennent illisibles — et un joueur qui martele
 * son portrait pourrait couvrir le plateau. La bulle du siege du haut descend,
 * celle du bas monte : chacune s'ouvre vers le plateau, jamais vers le bord.
 */
function bubble(seat, contenu, classe) {
  /* ⚠️ LA BULLE PENDAIT A LA CARTE DU JOUEUR, ET LA CARTE A CHANGE DE TAILLE.
     C'etait un bandeau pleine largeur en haut ou en bas de l'ecran : une bulle
     posee dessous avait de la place et 78 % d'une largeur d'ecran pour s'ecrire.
     La carte n'est plus qu'un demi-panneau au MILIEU de l'ecran : la bulle
     s'ouvrait donc par-dessus le rectangle central, large de quelques mots, et
     rognee. « Les messages des capitaines s'affichent mal maintenant. »
     Elle pend desormais a la barre entiere, qui fait toute la largeur, et sort
     du bon cote — vers le plateau de celui qui parle. */
  const barre = document.querySelector('#dc-screen-game .dc-versus-wrap');
  const carte = barre || $(seat === S.seat ? '#dc-pc-me' : '#dc-pc-foe');
  if (!carte) return;
  const ancienne = carte.querySelector('.dc-bulle' + (seat === S.seat ? '.dc-bulle-me' : '.dc-bulle-foe'));
  if (ancienne) ancienne.remove();

  const el = document.createElement('div');
  el.className = 'dc-bulle ' + (seat === S.seat ? 'dc-bulle-me' : 'dc-bulle-foe')
               + (classe ? ' ' + classe : '');
  if (contenu instanceof Node) el.appendChild(contenu);
  else el.textContent = contenu;
  carte.appendChild(el);

  /* ⚠️ L'ALERTE DE TOUR ET CETTE BULLE VISENT LE MEME CIEL. Toutes deux pendent
     au-dessus du rectangle du centre : la bulle de l'adversaire, large de 45 %
     et parfois haute de deux lignes, passait PAR-DESSUS la pastille « c'est au
     tour de… » et la coupait en deux — reproduit au banc d'essai.

     ⛔ ET UN DECALAGE FIXE NE REGLE RIEN. Un premier essai remontait l'alerte
     de 46 px : une bulle d'une ligne passait, une bulle de deux la recouvrait
     encore. La hauteur d'une replique depend de sa longueur, de la langue et de
     l'echelle du texte — elle se MESURE, comme tout le reste de cet ecran.
     On la publie donc a la feuille de style, qui empile l'alerte au-dessus. */
  if (barre && el.classList.contains('dc-bulle-foe')) {
    barre.style.setProperty('--pd-bulle-h', el.getBoundingClientRect().height + 'px');
  }
  const chasser = poser(el, classe === 'dc-bulle-mood' ? '..' : contenu);
  /* Quand la bulle s'en va, l'alerte redescend : une place reservee a un
     message disparu est une place perdue a chaque tour. */
  if (barre && el.classList.contains('dc-bulle-foe')) {
    const veille = new MutationObserver(() => {
      if (el.parentNode) return;
      barre.style.removeProperty('--pd-bulle-h');
      veille.disconnect();
    });
    veille.observe(barre, { childList: true });
  }
  return chasser;
}

/** Envoyer son humeur. Le serveur decide si elle passe — ici on ne fait qu'oser. */
export function sendMood(index) {
  if (S.net) S.net.send({ t: 'mood', mood: index });
}

/**
 * Passe la liste d'effets en revue et dit ce qu'il faut dire.
 * Appele APRES le dessin, pour qu'un mot n'arrive jamais avant son image.
 */
export function announce(fx) {
  /* ⚠️ UN EFFET QUI TOMBE EMPORTAIT TOUS LES SUIVANTS. La boucle etait nue :
     la premiere exception remontait au dispatch, qui l'ecrivait dans une
     console que personne ne lit sur un telephone, et la moitie du tour ne
     s'affichait jamais. Vecu avec `barre` : l'annonce du bonus tombait, et la
     destruction annoncee derriere disparaissait avec elle — de l'exterieur,
     « le jeu a plante sans raison ».

     Chaque effet est donc isole. Un effet perdu vaut mieux qu'un tour perdu, et
     le nom de l'effet fautif part dans la console plutot qu'une trace muette. */
  for (const f of fx) {
    try { unEffet(f); }
    catch (e) { console.error('[dice] effet ' + (f && f.kind) + ' :', e.message); }
  }
}

function unEffet(f) {
    if (f.kind === 'mood') {
      bulleImage(f.seat, f.mood);
      return;
    }

    if (f.kind === 'taunt') {
      /* La replique est choisie par le SERVEUR : les deux joueurs voient la
         meme, chacun dans sa langue. Un tirage cote client donnerait deux
         phrases differentes pour un seul evenement. */
      const dit = t('taunt.' + f.key + '.' + f.line);
      if (dit && !dit.startsWith('taunt.')) bubble(f.seat, dit);
      return;
    }

    if (f.kind === 'broadside') {
      banner(t('fx.broadside', { n: f.count }), f.seat === S.seat ? 'good' : 'bad');
      shake();
      buzz(f.seat === S.seat ? [0, 40, 60, 90] : 60);
      return;
    }

    if (f.kind === 'trait') {
      const nom = t('cap.trait.' + f.trait);
      if (!nom || nom.startsWith('cap.trait.')) return;
      if (f.seat === S.seat) banner(nom, 'good');
      else toast(t('fx.foeTrait', { name: nomDuSiege(f.seat), trait: nom }), 'warn');
      return;
    }

    if (f.kind === 'bonus') {
      annonceBonus(f);
      return;
    }

    if (f.kind === 'boost') {
      /* Le camp qui benit doit voir OU. Les deux ecrans l'apprennent : c'est une
         information publique, elle change le calcul de l'adversaire aussi. */
      banner(t('fx.boost'), f.seat === S.seat ? 'good' : 'bad');
      return;
    }

    /* LE GEL, DES DEUX COTES.
       Celui qui gele voit une banniere ; celui qui perd son tour doit voir
       davantage — sans quoi il attend un tour qui ne vient pas et croit a un
       blocage, exactement comme pour les bonus muets. Le sceau glace tient le
       temps qu'il faut pour comprendre, puis s'efface. */
    if (f.kind === 'freeze') {
      banner(t('fx.freeze'), f.seat === S.seat ? 'good' : 'bad');
      return;
    }

    if (f.kind === 'frozen') {
      /* ⚠️ PLUS DE SCEAU PLEIN CADRE ICI. Le givre est desormais POSE sur le
         plateau pendant tout le gel (voir `renderGel` dans dice_match.js) :
         cet effet-ci n'arrive qu'au moment ou le tour est effectivement saute,
         c'est-a-dire quand le givre s'en va. Rejouer un sceau par-dessus, c'est
         annoncer une seconde fois ce qu'on regardait depuis dix secondes. */
      if (f.seat === S.seat) { banner(t('fx.frozenYou'), 'bad'); buzz([0, 60, 40, 60]); }
      else banner(t('fx.frozenThem', { name: nomDuSiege(f.seat) }), 'good');
      return;
    }

    if (f.kind === 'peek') {
      /* Seul celui qui regarde a besoin de le savoir : prevenir l'adversaire
         qu'on vient de lire son prochain de lui donnerait l'information en
         retour, et le trait se retournerait contre son porteur. */
      if (f.seat === S.seat) toast(t('fx.next'), 'ok');
      return;
    }

  if (f.kind === 'place' && f.seat === S.seat) buzz(18);
}

/**
 * « ON NE SAIT PAS CE QUI S'EST PASSE. »
 *
 * Un effet joue ne se voyait que par ses consequences : un de qui disparait, un
 * de qui change de valeur. L'IA avait bien une petite notification, mais elle
 * partait avec la destruction — donc trop vite pour etre lue — et un adversaire
 * HUMAIN, lui, jouait son canon en silence complet.
 *
 * L'annonce est desormais un panneau plein cadre : l'image de l'effet, qui l'a
 * joue, et ce qu'il fait. Elle tient 2,6 s, soit deux fois la duree de
 * l'explosion qu'elle explique, et elle est cerclee de rouge quand elle vise le
 * joueur — la couleur dit « ca te concerne » avant meme qu'on ait lu.
 */

/* Le sceau de gel : plein cadre, 1,6 s. Il dit « ton tour vient d'etre pris »
   a celui qui le subit, et rien a l'autre — qui, lui, sait ce qu'il a fait. */
/* ⛔ `sceauDeGel()` A ETE SUPPRIME. C'etait un sceau plein cadre de 1,6 s, pose
   au milieu de l'ecran — donc nulle part en particulier — et deja mal ancre :
   il pendait a `.dc-arena`, un conteneur en grille, ou un enfant absolu se cale
   tantot sur tout, tantot sur une rangee selon le moteur.
   Le givre est maintenant POSE SUR LE PLATEAU gele, a sa taille, et il y reste
   tant que dure le gel : c'est `renderGel()` dans dice_match.js, nourri par
   l'etat `gele` que le serveur envoie desormais dans son instantane. */


function annonceBonus(f) {
  const arene = document.querySelector('#dc-screen-game .dc-arena');
  if (!arene) return;
  const ancienne = arene.querySelector('.dc-cast');
  if (ancienne) ancienne.remove();

  const mien = f.seat === S.seat;
  const contreMoi = !mien && f.target === S.seat;
  const nom = t('shop.' + f.identify + '.name');
  const quoi = nom.startsWith('shop.') ? f.identify : nom;
  const qui = mien ? t('fx.bonusYou') : nomDuSiege(f.seat);

  const el = document.createElement('div');
  el.className = 'dc-cast' + (mien ? ' dc-cast-me' : contreMoi ? ' dc-cast-vs' : '');
  el.innerHTML = '<img class="dc-cast-art" src="' + bonusArt(f.identify) + '" alt="">'
    + '<div class="dc-cast-txt"><b>' + esc(qui) + '</b><span>' + esc(quoi) + '</span></div>';
  /* ⚠️ CE NOM N'EXISTAIT PAS. `barre` n'etait declare nulle part : chaque
     annonce levait une ReferenceError, avalee par le try/catch du dispatch.
     Le joueur ne voyait donc plus qui avait joue quel bonus — et, pire, l'
     exception coupait la boucle des effets : la destruction annoncee juste
     apres n'etait jamais dessinee. « L'IA a detruit mon de et joue juste
     apres, je n'ai rien compris ». */
  arene.appendChild(el);

  /* Une secousse et une vibration seulement quand on ENCAISSE : signaler de la
     meme facon ce qu'on inflige et ce qu'on subit revient a ne rien signaler. */
  if (contreMoi) { shake(); buzz([0, 30, 50, 80]); }

  poser(el, qui + ' ' + quoi);
}

/*
 * LA PENDULE DU TOUR.
 *
 * Passe un delai, l'IA joue a la place de celui qui n'a rien fait. Le serveur
 * l'annoncait deja (`state.awayMs`), mais l'ecran ne le montrait pas : le
 * joueur voyait un de tomber tout seul sans comprendre — retour du telephone,
 * « il nous faut une sorte de timer pour savoir si ca va passer en auto ».
 *
 * L'etat n'arrive qu'a chaque coup ; la jauge, elle, doit descendre en continu.
 * On interpole donc localement a partir de l'instant de reception, et on
 * s'arrete des que le tour change — une pendule qui continue apres coup ment
 * plus qu'elle n'informe.
 */
let clockTimer = 0;

function stopClock() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
  const game = $('#dc-screen-game');
  if (game) game.querySelectorAll('.dc-pc').forEach((c) => c.classList.remove('dc-pc-timed'));
}

export function startClock(st) {
  stopClock();
  const total = (S.rules && S.rules.awayMs) || 0;
  if (!total || st.phase !== 'playing' || st.awayMs === null || st.awayMs === undefined) return;

  const carte = $(st.turn === S.seat ? '#dc-pc-me' : '#dc-pc-foe');
  if (!carte) return;
  const fin = Date.now() + st.awayMs;
  const tour = st.turn;
  carte.classList.add('dc-pc-timed');

  const peindre = () => {
    if (!S.state || S.state.phase !== 'playing' || S.state.turn !== tour) { stopClock(); return; }
    const reste = Math.max(0, fin - Date.now());
    carte.style.setProperty('--pd-clock', (reste / total).toFixed(3));
    carte.classList.toggle('dc-pc-urgent', reste < 8000);
    if (reste <= 0) stopClock();
  };
  peindre();
  clockTimer = setInterval(peindre, 200);
}

/* ─────────────────────────────────── ce que Ching Shih voit avant les autres ── */

/**
 * Le prochain de de l'adversaire, quand on a paye pour le voir.
 *
 * ⚠️ LE BOUTON A DISPARU D'ICI. Il vivait seul dans le coin du bandeau adverse,
 * avec son propre dessin et son propre compteur : une commande a apprendre, a
 * cote d'un ratelier ou vivaient deja toutes les autres. La longue-vue est
 * l'effet B004 — meme place, meme dessin, meme geste. Il ne reste ici que
 * l'AFFICHAGE de ce qu'elle revele.
 *
 * ⚠️ C'est le SERVEUR qui envoie la valeur, et seulement quand la longue-vue
 * est ouverte : si le client decidait de ce droit, il suffirait de le modifier
 * pour voir tout le temps.
 */
export function renderForesee(st, dieFace) {
  const carte = $('#dc-pc-foe');
  if (!carte) return;
  const ancien = carte.querySelector('.dc-foresee');
  if (ancien) ancien.remove();
  if (st.phase !== 'playing') return;
  if (st.foresee === null || st.foresee === undefined) return;

  const el = document.createElement('div');
  el.className = 'dc-foresee dc-foresee-on';
  el.title = t('cap.ching.trait');
  el.innerHTML = '<span class="dc-foresee-lbl">' + esc(t('fx.next')) + '</span>'
    + dieFace(st.foresee, false, skinOf(1 - S.seat));
  carte.appendChild(el);
}
