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
/**
 * @param {number} [siege] le siege CONCERNE par l'annonce, s'il y en a un.
 *
 * ⚠️ UNE BANNIERE AU CENTRE NE DIT PAS DE QUI ELLE PARLE. « Bordee ! » s'ecrivait
 * au meme endroit que mon de soit detruit ou que je detruise celui d'en face :
 * il fallait lire la phrase pour savoir de quel cote regarder. Elle sort
 * desormais du cote du plateau concerne — en bas si c'est moi, en haut si c'est
 * l'autre — comme les repliques et l'alerte de tour. Sans siege, elle reste au
 * centre : ce qui n'appartient a personne n'a pas de cote.
 */
function banner(texte, ton, siege) {
  const arene = document.querySelector('#dc-screen-game .dc-arena');
  if (!arene) return;
  const now = Date.now();
  if (now - derniere < 400) return;
  derniere = now;

  /* ⛔ LE COTE A ETE RETIRE DE LA BANNIERE. Posee sur le plateau du joueur
     concerne, celle du haut passait sous l'entete et se coupait. Une banniere
     se lit AU CENTRE ; c'est son ton — dore ou rouge — qui dit pour qui elle
     parle. Le parametre reste dans la signature parce que les appels le
     donnent, et parce qu'il redeviendra utile si l'entete disparait un jour. */
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
  const enHaut = el.classList.contains('dc-bulle-foe');
  const nom = enHaut ? '--pd-bulle-h' : '--pd-bulle-me-h';
  if (barre) barre.style.setProperty(nom, el.getBoundingClientRect().height + 'px');
  /* ⛔ LA DUREE D'AFFICHAGE SE CALCULE SUR LA LONGUEUR DU TEXTE, et `poser`
     recevait ici le CONTENU tel quel. Tant que c'etait une chaine, tout allait
     bien ; depuis que l'annonce d'effet passe par une bulle, le contenu est un
     noeud du DOM — sa `.length` vaut `undefined`, la duree devient `NaN`, et
     `setTimeout(fn, NaN)` part IMMEDIATEMENT. La bulle etait donc bien creee,
     bien accrochee, et retiree dans la meme image : aucune exception, aucune
     trace, et rien a l'ecran. On lui passe le texte, qui est ce qu'elle mesure. */
  const aMesurer = classe === 'dc-bulle-mood' ? '..'
    : (contenu instanceof Node ? (contenu.textContent || '') : contenu);
  const chasser = poser(el, aMesurer);
  /* Quand la bulle s'en va, l'alerte redescend : une place reservee a un
     message disparu est une place perdue a chaque tour. */
  if (barre) {
    const veille = new MutationObserver(() => {
      if (el.parentNode) return;
      barre.style.removeProperty(nom);
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
      /* La bordee frappe l'AUTRE plateau : c'est la que le coup se voit, et
         c'est donc la que le mot se pose. */
      banner(t('fx.broadside', { n: f.count }), f.seat === S.seat ? 'good' : 'bad', 1 - f.seat);
      shake();
      buzz(f.seat === S.seat ? [0, 40, 60, 90] : 60);
      return;
    }

    if (f.kind === 'trait') {
      const nom = t('cap.trait.' + f.trait);
      if (!nom || nom.startsWith('cap.trait.')) return;
      if (f.seat === S.seat) banner(nom, 'good', f.seat);
      else toast(t('fx.foeTrait', { name: nomDuSiege(f.seat), trait: nom }), 'warn');
      return;
    }

    if (f.kind === 'bonus') {
      /* Un effet joue doit s'ENTENDRE : c'est le seul coup du jeu qui ne se
         voit pas forcement sur le plateau. */
      if (S.sfx) S.sfx.play('effet', 0.34);
      annonceBonus(f);
      return;
    }

    if (f.kind === 'boost') {
      /* Le camp qui benit doit voir OU. Les deux ecrans l'apprennent : c'est une
         information publique, elle change le calcul de l'adversaire aussi. */
      banner(t('fx.boost'), f.seat === S.seat ? 'good' : 'bad', f.seat);
      return;
    }

    /* LE GEL, DES DEUX COTES.
       Celui qui gele voit une banniere ; celui qui perd son tour doit voir
       davantage — sans quoi il attend un tour qui ne vient pas et croit a un
       blocage, exactement comme pour les bonus muets. Le sceau glace tient le
       temps qu'il faut pour comprendre, puis s'efface. */
    if (f.kind === 'freeze') {
      /* Celui qui gele agit ; le gel, lui, tombe sur l'autre plateau. */
      if (S.sfx) S.sfx.play('gel', 0.38);
      banner(t('fx.freeze'), f.seat === S.seat ? 'good' : 'bad', 1 - f.seat);
      return;
    }

    if (f.kind === 'frozen') {
      /* ⚠️ PLUS DE SCEAU PLEIN CADRE ICI. Le givre est desormais POSE sur le
         plateau pendant tout le gel (voir `renderGel` dans dice_match.js) :
         cet effet-ci n'arrive qu'au moment ou le tour est effectivement saute,
         c'est-a-dire quand le givre s'en va. Rejouer un sceau par-dessus, c'est
         annoncer une seconde fois ce qu'on regardait depuis dix secondes. */
      /* Le givre se brise : le tour saute maintenant, et l'oreille le sait
         avant que l'oeil ait retrouve le plateau. */
      if (S.sfx) S.sfx.play('degel', 0.34);
      if (f.seat === S.seat) { banner(t('fx.frozenYou'), 'bad', f.seat); buzz([0, 60, 40, 60]); }
      else banner(t('fx.frozenThem', { name: nomDuSiege(f.seat) }), 'good', f.seat);
      return;
    }

    /* ══ LES CINQ EFFETS DES NOUVEAUX CAPITAINES ══
       ⚠️ CHACUN DOIT S'ANNONCER, MEME CELUI QU'ON VOIT. Le gel de colonne se
       dessine sur trois cases et la malediction change un total : on pourrait
       croire l'annonce inutile. Elle ne l'est pas — c'est elle qui dit QUI a
       agi, et sans elle le joueur constate un changement sans coupable, ce qui
       est exactement le defaut qu'on a mis trois versions a corriger sur le
       gel. Les deux ecrans l'apprennent : ces effets sont publics. */
    if (f.kind === 'gelcol') {
      if (S.sfx) S.sfx.play('gel', 0.38);
      /* La banniere se pose sur le plateau GELE, pas sur celui qui gele : c'est
         la qu'on regarde pour comprendre ce qui vient de changer. */
      banner(t('fx.gelcol'), f.seat === S.seat ? 'bad' : 'good', f.seat);
      if (f.seat === S.seat) buzz([0, 50, 40, 50]);
      return;
    }

    if (f.kind === 'maudit') {
      banner(t('fx.curse'), f.seat === S.seat ? 'bad' : 'good', f.seat);
      return;
    }

    /* ══ LES CINQ EFFETS DU SECOND LOT — B012 a B016 ══
       Meme regle que ci-dessus : un effet qui se voit doit quand meme
       s'annoncer, parce que l'annonce dit QUI a agi. Le brouillard et la coque
       se DESSINENT (voir `renderGel` et ses trois couches) ; ce qui suit ne fait
       que raconter, et l'etat du serveur fait le reste. */
    if (f.kind === 'brume') {
      /* `f.seat` est le plateau qui entre — ou sort — de la brume, donc celui
         qui est PROTEGE. Pour lui c'est une bonne nouvelle, pour l'autre non :
         c'est l'inverse exact du gel, et la couleur doit suivre. */
      const mien = f.seat === S.seat;
      if (f.on) {
        if (S.sfx) S.sfx.play('gel', 0.3);
        banner(t(mien ? 'fx.brumeYou' : 'fx.brumeThem',
                 { name: nomDuSiege(f.seat) }), mien ? 'good' : 'bad', f.seat);
      } else {
        /* Elle se dissipe parce qu'elle a SERVI : on dit combien de des elle
           vient de sauver, sans quoi le joueur voit un brouillard disparaitre
           sans comprendre ce qu'il a fait. */
        banner(t(mien ? 'fx.brumeSaved' : 'fx.brumeBlocked',
                 { n: f.sauves || 0, name: nomDuSiege(f.seat) }),
               mien ? 'good' : 'bad', f.seat);
      }
      return;
    }

    if (f.kind === 'coque') {
      const mien = f.seat === S.seat;
      /* Trois moments, trois phrases : elle se pose, elle encaisse, elle
         expire. Seule l'expiration muette ne merite rien — la case se denude,
         cela suffit. */
      if (f.on) {
        if (S.sfx) S.sfx.play('gel', 0.28);
        banner(t(mien ? 'fx.coqueYou' : 'fx.coqueThem',
                 { name: nomDuSiege(f.seat) }), mien ? 'good' : 'bad', f.seat);
      } else if (f.sauve) {
        if (S.sfx) S.sfx.play('degel', 0.34);
        banner(t(mien ? 'fx.coqueSaved' : 'fx.coqueBlocked',
                 { name: nomDuSiege(f.seat) }), mien ? 'good' : 'bad', f.seat);
        if (mien) buzz([0, 40]);
      }
      return;
    }

    if (f.kind === 'manoeuvre') {
      /* Rien ne disparait : c'est le seul effet, avec le troc, dont la trace est
         un de qui a change de place. L'annonce le dit, la grille le montre. */
      banner(t(f.seat === S.seat ? 'fx.manoeuvreYou' : 'fx.manoeuvreThem',
               { name: nomDuSiege(f.seat) }), f.seat === S.seat ? 'good' : 'bad', f.seat);
      return;
    }

    if (f.kind === 'quart') {
      /* ⚠️ IL VAUT POUR LES DEUX, DONC IL N'EST NI BON NI MAUVAIS. Toutes les
         autres annonces se colorent selon le camp ; celle-ci ne le peut pas —
         les multiplicateurs changent des deux cotes, et qui y gagne depend des
         des deja poses. Le ton neutre est le seul honnete. */
      banner(t('fx.quart'), 'neutral', f.seat);
      return;
    }

    if (f.kind === 'rase') {
      /* La destruction elle-meme est deja annoncee par `destroy` (l'explosion
         des cases) : ce mot-ci dit que c'est la COLONNE ENTIERE qui est partie,
         ce qu'aucune explosion de case ne peut raconter toute seule. */
      banner(t('fx.wipe'), f.seat === S.seat ? 'bad' : 'good', f.seat);
      if (f.seat === S.seat) buzz([0, 60, 40, 60]);
      return;
    }

    if (f.kind === 'troc') {
      if (S.sfx) S.sfx.play('effet', 0.34);
      banner(t('fx.swap'), f.seat === S.seat ? 'good' : 'bad', f.seat);
      return;
    }

    /* ⛔ CETTE BRANCHE ETAIT MORTE, ET LA BANNIERE N'APPARAISSAIT JAMAIS. Le
       sablier ne rallonge plus le tour de celui qui le joue : depuis Anne Bonny,
       il PRESSE celui d'en face — « le bonus accelere le prochain tour de
       l'adversaire ». Le serveur emet donc `presse`, avec le siege de la VICTIME,
       et plus jamais `lent`. Personne n'avait suivi cote ecran : la banniere
       « Tour presse » etait traduite dans les quatre langues et ne s'affichait
       nulle part, si bien que la victime voyait sa pendule tomber de moitie sans
       la moindre explication.
       ⚠️ ET C'EST ELLE QU'ON PREVIENT, pas le porteur : c'est sa pendule qui
       change. Le porteur, lui, voit deja passer l'annonce de l'effet. */
    if (f.kind === 'presse') {
      if (f.seat === S.seat) banner(t('fx.slow'), 'bad', f.seat);
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
  /* ⛔ CETTE FONCTION S'ARRETAIT SUR UN GARDE QUI NE LA CONCERNE PLUS. Elle
     commencait par chercher l'arene pour y poser sa carte `dc-cast` et sortait
     si elle ne la trouvait pas. La carte n'existe plus — l'annonce est une bulle
     accrochee a la barre des capitaines — mais le garde, lui, etait reste : il
     rendait la main en silence, sans exception et sans trace, et plus aucune
     annonce d'effet ne s'affichait. Un garde survivant a ce qu'il gardait est un
     bogue muet, le plus long a trouver. */
  const mien = f.seat === S.seat;
  const contreMoi = !mien && f.target === S.seat;
  /* ⚠️ ON LISAIT LE NOM DE L'OBJET EN BOUTIQUE, ET CA NE VOULAIT RIEN DIRE ICI.
     « Geler l'adversaire » sous le portrait de Molly, c'est une etiquette de
     catalogue collee sur un coup de theatre — et selon l'effet on passait d'une
     phrase a la premiere personne a une phrase a la troisieme, sans logique
     apparente. Retour de l'admin : « parfois ca dit l'ennemi a detruit mon de,
     parfois molly freeze the enemy ».

     Chaque capitaine a maintenant SA REPLIQUE pour chaque effet — c'est lui qui
     parle, a la premiere personne, avec son caractere. Le nom de l'objet reste
     le repli si une replique manque : mieux vaut une etiquette qu'un vide. */
  const cap = S.state && S.state.captains ? S.state.captains[f.seat] : null;
  /* ⚠️ LA VARIANTE DOIT ETRE LA MEME DES DEUX COTES DE LA TABLE. Un tirage au
     sort local donnerait deux phrases differentes pour un seul evenement — le
     defaut qu'on avait deja corrige sur les repliques de capitaine, qui sont
     choisies par le serveur. On ne peut pas demander au serveur ici : c'est le
     client qui compose la phrase. On la tire donc d'un nombre que LES DEUX
     ECRANS connaissent au meme instant — le nombre de des poses, lu dans l'etat
     qui vient d'etre applique. Meme etat, meme compte, meme phrase. */
  let tour = 0;
  if (S.state && S.state.grids) {
    for (const g of S.state.grids) for (const v of g) if (v !== null) tour++;
  }
  const VARIANTES = 5;
  const variante = tour % VARIANTES;
  const propre = cap ? t('say.' + cap + '.' + f.identify + '.' + variante) : '';
  /* ⚠️ TROIS ETAGES, ET LE DEUXIEME EST NEUF. Dix capitaines et onze effets font
     330 repliques par langue, soit 1320 phrases a ecrire pour un jeu qui en
     affiche trois par partie. On garde la voix du capitaine la ou elle compte —
     son PROPRE trait, celui qu'il joue a chaque partie — et tout le reste tombe
     sur une replique ecrite pour l'EFFET, pas pour la bouche qui la dit. Le
     dernier etage reste le nom de l'effet : une etiquette vaut mieux qu'un vide,
     mais elle ne raconte rien, et c'est justement ce qu'on voulait eviter. */
  const commune = t('say.any.' + f.identify + '.' + variante);
  const nom = t('shop.' + f.identify + '.name');
  const dite = propre && !propre.startsWith('say.') ? propre
    : (commune && !commune.startsWith('say.') ? commune : '');
  const quoi = dite || (nom.startsWith('shop.') ? f.identify : nom);
  const qui = mien ? t('fx.bonusYou') : nomDuSiege(f.seat);

  /* ⛔ DEUX CANAUX DISAIENT LA MEME CHOSE, ET L'UN COUVRAIT L'AUTRE. L'annonce
     d'effet etait une carte posee au milieu de l'arene (`dc-cast`) : elle
     arrivait par-dessus le plateau, cachait le coup qu'elle annoncait, et
     doublait la bulle de replique qui pend deja a la barre des capitaines.
     « Retirer le message quand un joueur joue un bonus, et mettre plutot le
     contenu du message dans la tooltip de dialogue durant une partie, avec
     l'icone de l'effet en debut de phrase. »
     Un seul canal, donc : celui qui existait deja et qui sait d'ou il sort —
     du cote de celui qui parle. L'icone ouvre la phrase, comme un visage. */
  const bulle = document.createElement('span');
  bulle.className = 'dc-dit';
  const icone = document.createElement('img');
  icone.className = 'dc-dit-art';
  icone.src = bonusArt(f.identify);
  icone.alt = '';
  bulle.appendChild(icone);
  bulle.appendChild(document.createTextNode(quoi));

  /* Une secousse et une vibration seulement quand on ENCAISSE : signaler de la
     meme facon ce qu'on inflige et ce qu'on subit revient a ne rien signaler. */
  if (contreMoi) { shake(); buzz([0, 30, 50, 80]); }

  bubble(f.seat, bulle, 'dc-bulle-effet');
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

/* ⛔ LA JAUGE ETAIT UN DEGRADE CONIQUE, ET C'ETAIT LE MAUVAIS OUTIL. Un dégradé
   conique se mesure en ANGLE depuis le centre : sur un rectangle, la meme
   seconde couvre trois fois plus de bord dans un coin qu'au milieu d'un cote,
   et rien ne permet de dire OU en est la limite — donc rien ne permet d'y poser
   quoi que ce soit.

   C'est une MECHE : elle brule le long du jonc, a vitesse constante, et la
   flamme se tient exactement au point qui brule. Un trace SVG donne les deux —
   `stroke-dashoffset` mange la corde a vitesse constante, `getPointAtLength`
   dit ou en est le feu. Il n'y a plus rien a estimer.

   Trois traits superposes font la corde : la cendre (tout le tour, dessous), la
   corde restante, et une torsade en pointilles par-dessus — c'est elle qui
   donne le cordage plutot qu'un simple tuyau. */
const MECHE = { ancre: [77 / 181, 253 / 362] };   // la braise, dans l'image

/* La corde elle-meme est une IMAGE, pas un trait. Deux traits superposes
   faisaient un tuyau raye ; le cordage, lui, a une torsade qui tourne, une
   lumiere sur le dessus et un cerne noir — cela se dessine, cela ne se decrit
   pas en CSS. On la pose donc par MORCEAUX le long du jonc, chacun tourne dans
   le sens de la corde a cet endroit : elle suit les coins au lieu de les
   couper. */
const CORDE = new Image();
CORDE.src = ASSETS + 'img/fx_corde.png';
/* ⚠️ LA PREMIERE PEINTURE PEUT ARRIVER AVANT L'IMAGE. Sans ce rappel, le tour
   ou l'on ouvre l'application se joue avec un jonc nu : la corde n'apparait
   qu'au tour suivant, et on croit a un defaut d'affichage. */
CORDE.addEventListener('load', () => {
  const clock = $('.dc-pc-timed .dc-pc-clock');
  if (clock) {
    const trace = clock.querySelector('.dc-meche-trace');
    const part = parseFloat(getComputedStyle(clock.parentElement)
      .getPropertyValue('--pd-clock')) || 1;
    brulerLaMeche(clock, trace, part);
  }
});

const PAS = 4;          // longueur d'un morceau, en pixels d'ecran

function traceDuJonc(clock) {
  const r = clock.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  const svg = clock.querySelector('.dc-pc-meche');
  if (!svg) return null;
  const style = getComputedStyle(clock);
  const ep = parseFloat(style.getPropertyValue('--pd-meche-ep')) || 6;
  /* ⚠️ LE TRACE SUIT LE JONC, PAS L'EPAISSEUR DE LA CORDE. Le cordage est plus
     epais que le cadre — c'est ce qui le rend lisible — mais sa LIGNE DE COEUR
     doit passer au milieu du jonc, sinon l'anneau se decale vers l'interieur et
     ses coins cessent de suivre ceux de la carte. */
  const jonc = parseFloat(style.getPropertyValue('--pd-jonc')) || 3;
  const m = jonc / 2;
  const w = r.width - jonc;
  const h = r.height - jonc;
  /* ⚠️ LE RAYON LU EST CELUI DU BORD EXTERIEUR ; LA CORDE PASSE AU MILIEU DU
     JONC. Sans cette demi-epaisseur en moins, la corde coupait le coin — un
     arc trop large a l'interieur d'un cadre plus serre. */
  const rad = Math.max(0, Math.min(
    (parseFloat(style.borderTopLeftRadius) || 16) - m,
    w / 2, h / 2));
  /* ⛔ LE DEPART A QUITTE LE HAUT-CENTRE POUR L'EXTREMITE DE LA CARTE. « Decale
     le demarrage de la meche vers l'extreme de chaque rectangle : pour le joueur
     vers la droite, pour l'ennemi vers la gauche. » Le fanion du timer se pose a
     ce depart ; au centre, il couvrait le pseudo. Aux coins exterieurs — cote
     portrait, a l'oppose du nom — le pseudo reste entierement lisible.
     Les deux traces sont MIROIR l'un de l'autre : le mien part du coin haut-
     DROIT et tourne dans le sens des aiguilles, celui d'en face du coin haut-
     GAUCHE dans l'autre sens. La flamme descend alors vers l'exterieur des deux
     cotes, comme deux meches qui s'eloignent du centre. */
  const carte = clock.parentElement;
  const mine = !!(carte && carte.classList && carte.classList.contains('dc-pc-mine'));
  const d = mine ? [
    'M', m + w - rad, m,
    'A', rad, rad, 0, 0, 1, m + w, m + rad,
    'V', m + h - rad,
    'A', rad, rad, 0, 0, 1, m + w - rad, m + h,
    'H', m + rad,
    'A', rad, rad, 0, 0, 1, m, m + h - rad,
    'V', m + rad,
    'A', rad, rad, 0, 0, 1, m + rad, m,
    'H', m + w - rad,
    'Z',
  ].join(' ') : [
    'M', m + rad, m,
    'A', rad, rad, 0, 0, 0, m, m + rad,
    'V', m + h - rad,
    'A', rad, rad, 0, 0, 0, m + rad, m + h,
    'H', m + w - rad,
    'A', rad, rad, 0, 0, 0, m + w, m + h - rad,
    'V', m + rad,
    'A', rad, rad, 0, 0, 0, m + w - rad, m,
    'H', m + rad,
    'Z',
  ].join(' ');
  svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
  /* ⛔ ET ON NE REECRIT QUE SI LE TRACE A VRAIMENT CHANGE. `startClock` passe
     ici a CHAQUE instantane du serveur, donc plusieurs fois par tour, pour une
     carte qui garde la meme taille du debut a la fin de la partie. Reposer le
     meme `d` remet le trace a zero aux yeux du moteur : la longueur retenue et
     le decoupage de la corde etaient jetes a chaque coup, et tout etait a
     remesurer point par point. */
  svg.querySelectorAll('path').forEach((p) => {
    if (p.getAttribute('d') === d) return;
    p.setAttribute('d', d);
    p.__len = undefined;
    p.__corde = null;
  });

  /* La toile ou l'on peint la corde. Elle est en pixels REELS : a moitie de
     resolution, un cordage devient une bouillie. */
  const toile = clock.querySelector('.dc-meche-corde');
  if (toile) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const lw = Math.round(r.width * dpr);
    const lh = Math.round(r.height * dpr);
    /* ⚠️ ECRIRE `width` SUR UNE TOILE L'EFFACE, MEME POUR LA MEME VALEUR. Le
       cordage disparaissait donc a chaque instantane du serveur, et ne
       revenait qu'au battement suivant de la pendule. */
    if (toile.width !== lw || toile.height !== lh) {
      toile.width = lw;
      toile.height = lh;
      toile.style.width = r.width + 'px';
      toile.style.height = r.height + 'px';
    }
    toile.__dpr = dpr;
    toile.__ep = ep;
  }
  return svg.querySelector('.dc-meche-trace');
}

/**
 * La longueur du trace, retenue.
 *
 * ⛔ `getTotalLength` EST UN PARCOURS, PAS UNE LECTURE. Il etait appele trois
 * fois par battement de pendule pour un trace qui ne change qu'au redessin :
 * 180 appels et 123 ms sur douze secondes d'arene immobile, processeur bride
 * six fois. `traceDuJonc` efface la valeur quand il reecrit le `d` — c'est le
 * seul endroit ou la longueur peut changer.
 */
function longueurDuTrace(trace) {
  if (trace.__len === undefined) trace.__len = trace.getTotalLength();
  return trace.__len;
}

/**
 * LES MORCEAUX DE LA CORDE, MESURES UNE FOIS POUR TOUTES.
 *
 * ⛔ LE DECOUPAGE ETAIT REFAIT CINQ FOIS PAR SECONDE, ET IL NE CHANGE JAMAIS.
 * `getPointAtLength` demande au moteur SVG de parcourir le trace jusqu'a une
 * abscisse : c'est l'appel le plus cher de tout le jeu, et on en faisait deux
 * par morceau, cent-trente morceaux par battement, cinq battements par seconde
 * — pour retrouver a chaque fois EXACTEMENT les memes points, puisque le jonc
 * ne bouge pas pendant un tour. Mesure au banc, processeur bride six fois,
 * douze secondes d'arene ou il ne se passe rien : 7876 appels, 2379 ms, soit un
 * cinquieme du temps de l'appareil brule a redecouper une corde immobile.
 *
 * Le decoupage ne depend que de la LONGUEUR du trace et de l'epaisseur du
 * cordage. On le garde donc sur le trace lui-meme, sous cette cle : la carte
 * qui change de taille refait son trace, donc sa cle, donc son decoupage.
 */
function morceauxDeLaCorde(trace, total, ep) {
  const cle = total.toFixed(2) + ':' + ep;
  if (trace.__corde && trace.__corde.cle === cle) return trace.__corde;
  /* ⚠️ LA TORSADE DOIT RETOMBER SUR SES PIEDS. Un motif repete a sa longueur
     naturelle laisse un morceau coupe la ou la boucle se referme. On etire donc
     legerement le motif pour qu'il tienne un nombre ENTIER de fois. */
  const naturel = ep * (CORDE.naturalWidth / CORDE.naturalHeight);
  const tours = Math.max(1, Math.round(total / naturel));
  const long = total / tours;
  const bouts = Math.max(2, Math.ceil(long / PAS));
  const dl = long / bouts;
  const dsx = CORDE.naturalWidth / bouts;
  const morceaux = [];
  for (let t = 0; t < tours; t++) {
    for (let k = 0; k < bouts; k++) {
      const debut = t * long + k * dl;
      const a = trace.getPointAtLength(debut);
      const b = trace.getPointAtLength(Math.min(debut + dl, total));
      morceaux.push({
        fin: debut + dl, x: a.x, y: a.y,
        angle: Math.atan2(b.y - a.y, b.x - a.x), sx: k * dsx,
      });
    }
  }
  trace.__corde = { cle, morceaux, dl, dsx };
  return trace.__corde;
}

/** Peindre la corde restante, morceau par morceau, le long du jonc. */
function peindreCorde(clock, trace, brule) {
  const toile = clock.querySelector('.dc-meche-corde');
  if (!toile || !trace || !CORDE.complete || !CORDE.naturalWidth) return;
  const ctx = toile.getContext('2d');
  const dpr = toile.__dpr || 1;
  const ep = toile.__ep || 6;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, toile.width, toile.height);

  const total = longueurDuTrace(trace);
  if (!total) return;
  const decoupe = morceauxDeLaCorde(trace, total, ep);
  const dl = decoupe.dl;
  const dsx = decoupe.dsx;

  for (const m of decoupe.morceaux) {
    if (m.fin <= brule) continue;                     // deja consume
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    /* Un demi-pixel de recouvrement : sans lui, on voit la couture entre deux
       morceaux des que l'ecran arrondit. */
    ctx.drawImage(CORDE, m.sx, 0, dsx, CORDE.naturalHeight,
                  0, -ep / 2, dl + 0.5, ep);
    ctx.restore();
  }
}

/** Poser la corde et la flamme pour une part restante donnee (1 → 0). */
function brulerLaMeche(clock, trace, part) {
  if (!trace) return;
  const total = longueurDuTrace(trace);
  if (!total) return;
  const brule = (1 - part) * total;
  peindreCorde(clock, trace, brule);

  const flamme = clock.querySelector('.dc-pc-flamme');
  if (!flamme) return;
  const pt = trace.getPointAtLength(Math.min(brule, total - 0.01));
  const large = flamme.offsetWidth || 40;
  const haut = flamme.offsetHeight || 80;
  flamme.style.transform = 'translate(' + (pt.x - large * MECHE.ancre[0]) + 'px,'
    + (pt.y - haut * MECHE.ancre[1]) + 'px)';
}

/* Le nombre de secondes affiche sur la baniere du tour. On l'ecrit sur les DEUX
   cartes potentielles : `stopClock` l'efface, `startClock` le remet sur l'active. */
function poserSecondes(carte, reste) {
  const secs = carte && carte.querySelector('.dc-pc-secs');
  if (secs) secs.textContent = Math.max(0, Math.ceil(reste / 1000));
}

function stopClock() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
  const game = $('#dc-screen-game');
  if (!game) return;
  game.querySelectorAll('.dc-pc').forEach((c) => {
    c.classList.remove('dc-pc-timed');
    /* ⚠️ ET L'URGENCE AVEC. Elle n'etait retiree que par la reecriture de
       `className` dans le rendu de la carte — une dependance a l'ordre des
       appels, pas une regle : le jour ou ce rendu a cesse de tout effacer, la
       carte gardait sa flamme affolee jusqu'a la fin de la partie. */
    c.classList.remove('dc-pc-urgent');
  });
}

export function startClock(st) {
  stopClock();
  if (st.phase !== 'playing') return;

  const carte = $(st.turn === S.seat ? '#dc-pc-me' : '#dc-pc-foe');
  if (!carte) return;
  const tour = st.turn;
  carte.classList.add('dc-pc-timed');

  const clock = carte.querySelector('.dc-pc-clock');
  /* Le trace se refait a l'ouverture du tour : la carte a pu changer de taille
     entre-temps (rotation de l'ecran, clavier, une autre longueur de nom). */
  let corde = clock ? traceDuJonc(clock) : null;

  /* ⛔ SANS PENDULE, LA CARTE RESTAIT NUE — ET C'EST CE QU'ON A PRIS POUR UNE
     CARTE ETEINTE. « C'est mon tour et mon rectangle reste inactif. » Le
     serveur n'arme pas toujours la veille d'absence : jamais pour l'IA, jamais
     pendant une pause, plus du tout apres le dernier tour saute. On sortait
     alors sans rien poser, et le jonc du joueur qui a la main n'avait pas plus
     de corde que celui d'en face.
     La corde dit D'ABORD a qui est le tour ; le compte a rebours n'est qu'une
     precision de plus. Sans pendule, elle est simplement entiere. */
  /* ⛔ LA FLAMME PARTAIT DE LA OU ELLE S'ETAIT ARRETEE. Elle glisse d'un point
     a l'autre en 220 ms — ce qu'on veut entre deux battements de la pendule,
     et exactement ce qu'on ne veut pas au PREMIER : elle traversait la carte en
     diagonale depuis la fin du tour precedent avant de se poser au depart de la
     meche. « Elle commence au mauvais endroit puis elle arrive au bon. »
     On pose donc la premiere position SANS transition, et on la rend ensuite. */
  const flamme = clock ? clock.querySelector('.dc-pc-flamme') : null;
  if (flamme) {
    flamme.style.transition = 'none';
    requestAnimationFrame(() => { flamme.style.transition = ''; });
  }

  /* ⛔ LA MECHE DIVISAIT PAR LA DUREE DE BASE. `S.rules.awayMs` est la duree
     ORDINAIRE d'un tour — dix-huit secondes. Anne Bonny la rallonge de moitie :
     le reste annonce partait alors a vingt-sept sur dix-huit, soit une fraction
     de 1,5. La meche restait donc figee pleine pendant tout le premier tiers du
     tour, puis se mettait a bruler d'un coup — l'inverse exact de ce qu'une
     jauge doit montrer.
     Le serveur envoie desormais la duree REELLEMENT armee (`awayTotal`) a cote
     du reste. On la prend quand elle est la, et l'on retombe sur la duree de
     base pour un serveur qui ne l'enverrait pas encore. */
  const total = Number(st.awayTotal) || (S.rules && S.rules.awayMs) || 0;
  const minutee = !!total && st.awayMs !== null && st.awayMs !== undefined;
  if (!minutee) {
    carte.style.setProperty('--pd-clock', '1');
    poserSecondes(carte, total || 0);
    if (clock) brulerLaMeche(clock, corde, 1);
    return;
  }
  const fin = Date.now() + st.awayMs;

  const peindre = () => {
    if (!S.state || S.state.phase !== 'playing' || S.state.turn !== tour) { stopClock(); return; }
    const reste = Math.max(0, fin - Date.now());
    const part = reste / total;
    carte.style.setProperty('--pd-clock', part.toFixed(3));
    poserSecondes(carte, reste);
    carte.classList.toggle('dc-pc-urgent', reste < 8000);
    if (clock) {
      if (!corde || !corde.isConnected || !longueurDuTrace(corde)) corde = traceDuJonc(clock);
      brulerLaMeche(clock, corde, part);
    }
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
  /* ⛔ ELLE NOMMAIT LE TRAIT DE CHING SHIH, QUI RASE DESORMAIS UNE COLONNE.
     L'infobulle du de a venir empruntait la description d'un capitaine — celui
     qui offrait la longue-vue a l'epoque. Depuis, la longue-vue est passee a la
     Lionne Sanglante et Ching Shih a recu la bordee : survoler le de annonce
     donnait donc « sa bordee emporte deux colonnes face a face ». L'effet a un
     nom a lui, et il ne changera pas de main. */
  el.title = t('shop.B004.desc');
  el.innerHTML = '<span class="dc-foresee-lbl">' + esc(t('fx.next')) + '</span>'
    + dieFace(st.foresee, false, skinOf(1 - S.seat));
  carte.appendChild(el);
}
