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
const LIRE_SOCLE = 1900;
const LIRE_PAR_SIGNE = 55;
const LIRE_MIN = 2400;
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
export const MOODS = ['😂', '😡', '😱', '👏', '🤔'];

/**
 * Une bulle au-dessus d'un portrait.
 *
 * ⚠️ UNE SEULE BULLE PAR SIEGE A LA FOIS. Sans ce remplacement, deux repliques
 * rapprochees se superposent et deviennent illisibles — et un joueur qui martele
 * son portrait pourrait couvrir le plateau. La bulle du siege du haut descend,
 * celle du bas monte : chacune s'ouvre vers le plateau, jamais vers le bord.
 */
function bubble(seat, contenu, classe) {
  const carte = $(seat === S.seat ? '#dc-pc-me' : '#dc-pc-foe');
  if (!carte) return;
  const ancienne = carte.querySelector('.dc-bulle');
  if (ancienne) ancienne.remove();

  const el = document.createElement('div');
  el.className = 'dc-bulle ' + (seat === S.seat ? 'dc-bulle-me' : 'dc-bulle-foe')
               + (classe ? ' ' + classe : '');
  el.textContent = contenu;
  carte.appendChild(el);
  /* Une humeur se saisit d'un coup d'oeil : on lui compte deux signes, pas les
     deux octets de son glyphe. Une replique, elle, se lit vraiment. */
  poser(el, classe === 'dc-bulle-mood' ? '..' : contenu);
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
      bubble(f.seat, MOODS[f.mood] || MOODS[0], 'dc-bulle-mood');
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
      if (f.seat === S.seat) { sceauDeGel(); buzz([0, 60, 40, 60]); }
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
function sceauDeGel() {
  const arene = document.querySelector('#dc-screen-game .dc-arena');
  if (!arene) return;
  const ancien = arene.querySelector('.dc-gel');
  if (ancien) ancien.remove();
  const el = document.createElement('div');
  el.className = 'dc-gel';
  el.innerHTML = '<img src="' + ASSETS + 'img/fx_freeze.png" alt="">'
    + '<span>' + esc(t('fx.frozenYou')) + '</span>';
  arene.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

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
