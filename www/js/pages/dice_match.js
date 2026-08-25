/* ============================================================================
   pages/dice_match.js — the table itself: two boards, the cup, the bonuses.

   The server sends a FULL authoritative state after every action, plus a small
   list of effects (`fx`) describing what just happened. Drawing is therefore a
   diff: the state says what must be on screen, the effects say what to animate.
   That is what removed the desync of the original game, which shipped eight
   different incremental events and trusted the client to keep up.

   One subtlety: when dice are destroyed, the state already has them gone. We
   hold the victim's board frozen while the explosions play, then redraw it —
   otherwise the dice would vanish before the player saw why.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { toast } from '../ui/toast.js';
import { S, UI, ASSETS, screen, boardOf, myTurn, bonusArt, fxUrl , skinOf, arrondiDeCase } from './dice_state.js';
import { t } from '../core/i18n.js';
import { renderBet } from './dice_end.js';
import { buildBoard, renderBoard, markPlaced, blastCells, cupArt, dieFace,
         tumble, showLanding, clearLanding, freeCellOf } from './dice_board.js';
import { announce, renderForesee, startClock, MOODS, sendMood } from './dice_fx.js';
import { captainArt, traitArt, captainName, captainTrait } from './dice_lobby.js';

export function onMatch(m) {
  S.queued = false;
  S.lastScores = null;
  S.seat = m.seat;
  S.state = m.state;
  buildGame();
  screen('game');
  paint(true);
  /* Une partie qui reapparait sans un mot ressemble a un bug. On nomme ce qui
     vient de se passer, sinon le joueur croit avoir relance au hasard. */
  if (m.resumed) toast(t('resume.done'), 'ok');
}

function buildGame() {
  const el = $('#dc-screen-game');
  /* ⚠️ CETTE ARENE SUIT LA MAQUETTE DE L'ADMIN, ET ELLE CHANGE TROIS CHOSES.

     1. LES DEUX JOUEURS SE FONT FACE AU CENTRE. Ils occupaient le haut et le
        bas de l'ecran, donc on ne pouvait pas comparer deux scores sans
        traverser l'ecran des yeux. Cote a cote autour du medaillon, l'ecart se
        lit d'un coup — c'est la seule information qui compte a chaque tour.
     2. LE GOBELET DESCEND DANS UN BANDEAU, avec la cale et la sortie. Trois
        boutons au pouce, la ou il n'y avait qu'un gobelet flottant.
     3. LA CALE S'OUVRE EN EVENTAIL. Le ratelier vivait dans la carte du joueur
        et lui disputait sa largeur ; il se deploie desormais au-dessus du
        bandeau, et ne coute rien quand il est ferme.

     Les identifiants ne bougent PAS (#dc-pc-me, #dc-pc-foe, #dc-cup, #dc-bonus,
     #dc-turn, #dc-quit, #dc-replay) : tout le reste du fichier s'y accroche. */
  el.innerHTML = `
    <div class="dc-arena">
      <div class="dc-boards">
        <div class="dc-board-slot" id="dc-slot-foe"></div>

        <div class="dc-versus pd-panel">
          <div class="dc-pc" id="dc-pc-foe"></div>
          <img class="dc-vs-mark" src="${ASSETS}img/icon_versus.png" alt="">
          <div class="dc-pc" id="dc-pc-me"></div>
        </div>
        <div class="dc-turn" id="dc-turn"></div>

        <div class="dc-board-slot" id="dc-slot-me"></div>
      </div>

      <!-- L'eventail de la cale, ferme par defaut. Il se pose AU-DESSUS du
           bandeau : deploye en dessous, le pouce qui l'ouvre le recouvrirait. -->
      <div class="dc-bonus" id="dc-bonus"></div>

      <div class="dc-foot">
        <button class="dc-foot-btn" id="dc-bag" title="${esc(t('bonus.head'))}">
          <img src="${ASSETS}img/icon_bag.png" alt="">
          <span>${esc(t('foot.bag'))}</span>
        </button>
        <button class="dc-foot-btn dc-foot-main" id="dc-cup" title="${esc(t('hdr.roll'))}">
          <!-- Le dessin vit dans un ecrin a lui : renderCup y ecrit le gobelet
               ou le de tire, et le libelle en dessous survit a la reecriture. -->
          <span class="dc-foot-art" id="dc-cup-slot"></span>
          <span>${esc(t('foot.roll'))}</span>
        </button>
        <!-- Rejouer prend la place du gobelet une fois la partie finie : c'est
             ce qu'on veut faire neuf fois sur dix, et le gobelet n'a plus rien
             a lancer. -->
        <button class="dc-foot-btn dc-foot-main" id="dc-replay" hidden>
          <img src="${ASSETS}img/icon_versus.png" alt="">
          <span>${esc(t('over.again'))}</span>
        </button>
        <button class="dc-foot-btn" id="dc-quit" title="${esc(t('game.leave'))}">
          <img src="${ASSETS}img/icon_leave.png" alt="">
          <span>${esc(t('foot.leave'))}</span>
        </button>
      </div>
    </div>
    <div class="dc-bet" id="dc-bet"></div>`;

  const foeWrap = buildBoard(1 - S.seat, true);
  const mineWrap = buildBoard(S.seat, false);
  $('#dc-slot-foe').appendChild(foeWrap);
  $('#dc-slot-me').appendChild(mineWrap);
  const foe = foeWrap.board;
  const mine = mineWrap.board;

  /* Survoler une colonne montre OU le de tomberait. C'est la seule facon de
     choisir sans compter les cases des yeux a chaque tour. */
  mine.querySelectorAll('.dc-col').forEach((col) => {
    col.onmouseenter = () => {
      if (!myTurn() || !S.state) return;
      if (S.state.pending && S.state.pending.seat === S.seat) return;
      const die = S.state.dice[S.seat];
      if (die === null) return;
      const cell = freeCellOf(S.state.grids[S.seat], parseInt(col.dataset.col, 10));
      if (cell >= 0) showLanding(mine, cell, die);
    };
    col.onmouseleave = () => clearLanding(mine);
    col.onclick = () => {
      if (S.state && S.state.pending && S.state.pending.seat === S.seat) return;
      if (!myTurn()) return;
      if (S.state.dice[S.seat] === null) { toast(t('game.rollFirst'), 'warn'); return; }
      clearLanding(mine);
      S.net.send({ t: 'place', column: parseInt(col.dataset.col, 10) });
    };
  });

  [foe, mine].forEach((board) => {
    board.querySelectorAll('.dc-cell').forEach((box) => {
      box.onclick = (ev) => {
        const pending = S.state && S.state.pending;
        if (!pending || pending.seat !== S.seat) return;
        if (parseInt(board.dataset.seat, 10) !== pending.target) return;
        /* ⚠️ UNE CIBLE DE COLONNE ACCEPTE UNE CASE VIDE. Le garde ci-dessous
           refusait tout ce qui n'etait pas un de deja pose : parfait pour un
           canon, mais une benediction se pose sur une colonne — vide comprise,
           et c'est meme la que le pari a le plus de sel. */
        if (!pending.column && !box.classList.contains('dc-cell-filled')) return;
        ev.stopPropagation();
        S.net.send({ t: 'cell', cell: parseInt(box.dataset.cell, 10) });
      };
    });
  });

  $('#dc-cup').onclick = () => {
    if (!myTurn()) { toast(t('game.waitTurn'), 'warn'); return; }
    if (S.state.dice[S.seat] !== null) { toast(t('game.alreadyRolled'), 'warn'); return; }
    S.net.send({ t: 'roll' });
  };
  $('#dc-quit').onclick = () => UI.requestClose();
  $('#dc-bag').onclick = (ev) => { ev.stopPropagation(); basculerCale(); };
  /* Un eventail ouvert se ferme au premier geste ailleurs : sans cela il reste
     en travers du plateau et il faut viser le sac a nouveau pour le refermer. */
  document.addEventListener('pointerdown', (ev) => {
    if (!ev.target.closest('#dc-bonus') && !ev.target.closest('#dc-bag')) fermerCale();
  });
  wireMoodFan();
}

/* ─────────────────────────────────── parler sans clavier ────────────────── */

let fanTimer = 0;

function closeFan() {
  if (fanTimer) { clearTimeout(fanTimer); fanTimer = 0; }
  const ouvert = document.querySelector('.dc-fan');
  if (ouvert) ouvert.remove();
}

/* Le rayon de l'arc — LA MEME VALEUR QUE `--pd-fan-r` dans la feuille de style —
   et la place qu'un bouton demande autour de lui. Le rayon vient de la corde
   minimale entre deux boutons voisins ; le detail est note cote CSS. */
const FAN_RAYON = 112;
const FAN_MARGE = 26;

/**
 * De quel cote l'eventail peut-il s'ouvrir ?
 *
 * ⚠️ UN ARC SYMETRIQUE SORTAIT DE L'ECRAN. Sur telephone le portrait du joueur
 * est colle au bord GAUCHE de son bandeau : un arc de -60° a +60° envoyait les
 * deux premieres humeurs en dehors de la page, ou elles etaient invisibles et
 * intouchables — mesure a l'ecran, deux boutons sur cinq hors cadre.
 *
 * On regarde donc la place reellement disponible autour du portrait et on choisit
 * le quart de tour qui tient. C'est mieux qu'une valeur pour le telephone et une
 * autre pour le bureau : la meme regle vaut pour une tablette, pour un ecran
 * partage, et pour le jour ou le bandeau changera de place.
 */
function fanAngles(portrait) {
  const r = portrait.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const besoin = FAN_RAYON + FAN_MARGE;

  const gauche = cx > besoin;
  const droite = window.innerWidth - cx > besoin;
  const haut = cy > besoin;

  /* 0° pointe vers le haut, les angles positifs vont vers la droite. */
  let debut = -60;
  let pas = 30;
  if (!gauche) { debut = 0; pas = 22.5; }            // colle a gauche : on ouvre a droite
  else if (!droite) { debut = -90; pas = 22.5; }     // colle a droite : on ouvre a gauche
  if (!haut) {                                       // pas de place au-dessus : on bascule
    debut = 180 - debut - pas * (MOODS.length - 1);
    debut = -debut;
  }
  return MOODS.map((_, i) => debut + i * pas);
}

function openFan(portrait) {
  closeFan();
  const fan = document.createElement('div');
  fan.className = 'dc-fan';
  /* Un eventail, pas une rangee : les cinq humeurs s'ouvrent en arc autour du
     portrait, la ou le pouce arrive deja. Chaque bouton est tourne de son angle
     puis REDRESSE par une seconde rotation sur le glyphe — sans quoi les emojis
     penchent et deviennent illisibles. */
  const angles = fanAngles(portrait);
  MOODS.forEach((glyphe, i) => {
    const b = document.createElement('button');
    b.className = 'dc-fan-btn';
    b.style.setProperty('--pd-angle', angles[i] + 'deg');
    b.innerHTML = '<span>' + glyphe + '</span>';
    b.onclick = (ev) => { ev.stopPropagation(); sendMood(i); closeFan(); };
    fan.appendChild(b);
  });
  portrait.appendChild(fan);
  /* Il se referme seul : un eventail oublie ouvert masque le plateau. */
  fanTimer = setTimeout(closeFan, 4000);
}

/**
 * L'appui long, sur le portrait DU JOUEUR seulement.
 *
 * ⚠️ DELEGUE, PAS POSE SUR LE PORTRAIT. La carte du joueur est reconstruite par
 * `innerHTML` a chaque coup : un ecouteur pose dessus disparaitrait au premier
 * lancer. On ecoute donc l'ecran, qui lui ne bouge pas.
 *
 * ⚠️ `pointercancel` COMPTE AUTANT QUE `pointerup`. Sur telephone, un doigt qui
 * glisse pendant l'attente devient un defilement et le navigateur annule le
 * pointeur : sans cette ecoute, la minuterie survivait et l'eventail s'ouvrait
 * en plein geste de defilement.
 */
function wireMoodFan() {
  const ecran = $('#dc-screen-game');
  if (!ecran) return;
  let attente = 0;
  let depart = null;

  const annuler = () => { if (attente) { clearTimeout(attente); attente = 0; } depart = null; };

  ecran.addEventListener('pointerdown', (ev) => {
    const portrait = ev.target.closest('#dc-pc-me .dc-pc-portrait');
    if (!portrait) { closeFan(); return; }
    depart = { x: ev.clientX, y: ev.clientY };
    attente = setTimeout(() => { attente = 0; openFan(portrait); }, 420);
  });
  ecran.addEventListener('pointermove', (ev) => {
    if (!attente || !depart) return;
    if (Math.abs(ev.clientX - depart.x) > 10 || Math.abs(ev.clientY - depart.y) > 10) annuler();
  });
  ecran.addEventListener('pointerup', annuler);
  ecran.addEventListener('pointercancel', annuler);
  ecran.addEventListener('contextmenu', (ev) => {
    /* L'appui long ouvre le menu du navigateur sur Android : on le refuse LA ou
       le geste nous appartient, et nulle part ailleurs. */
    if (ev.target.closest('#dc-pc-me .dc-pc-portrait')) ev.preventDefault();
  });
}

export function onState(msg) {
  S.state = msg.state;

  const fx = msg.fx || [];
  const destroyed = fx.filter((f) => f.kind === 'destroy');
  const placed = fx.find((f) => f.kind === 'place');

  const rolled = fx.find((f) => f.kind === 'roll');

  /* L'IA a joue a la place d'un absent : on le DIT. Sans un mot, le joueur voit
     un de tomber tout seul et croit a un bug — c'est exactement ce qu'il faut
     eviter quand on automatise le tour de quelqu'un. */
  const away = fx.find((f) => f.kind === 'away');
  if (away && !S.awaySaid) {
    S.awaySaid = true;
    setTimeout(() => { S.awaySaid = false; }, 4000);
    toast(away.seat === S.seat ? t('away.you') : t('away.taken', { name: away.name }), 'warn');
  }

  if (fx.some((f) => f.kind === 'start')) S.sfx.play('start', 0.22);
  if (rolled) S.sfx.play('dice', 0.3);

  /* ⚠️ LE DE NE DOIT PAS APPARAITRE AVANT D'AVOIR ROULE. `paint()` ecrivait la
     face definitive dans le gobelet des l'arrivee de l'etat, et le roulement
     partait APRES : on voyait le resultat, puis un defilement de faces, puis le
     meme resultat. Le drapeau ferme le gobelet a `paint()` pendant le lancer. */
  if (rolled && rolled.seat === S.seat) S.rolling = true;

  paint(false, new Set(destroyed.map((f) => f.seat)));

  /* Le de du joueur ROULE avant de se fixer : le gobelet vient d'etre secoue. */
  if (rolled && rolled.seat === S.seat) {
    const cup = $('#dc-cup-slot') || $('#dc-cup');
    if (cup) tumble(cup, rolled.value, () => { S.rolling = false; if (S.state) renderCup(S.state); }, skinOf(S.seat));
    else S.rolling = false;
  }

  /* La pose : le MEME de, joue plus sec et plus haut que le lancer. */
  if (placed) { S.sfx.play('dice', 0.42, 1.28); markPlaced(boardOf(placed.seat), placed.cell); }

  let settleIn = 0;
  if (destroyed.length) {
    S.visualLock++;
    for (const one of destroyed) {
      settleIn = Math.max(settleIn, blastCells(boardOf(one.seat), one.cells, () => S.sfx.play('boom', 0.3)));
    }
    setTimeout(() => {
      S.visualLock = Math.max(0, S.visualLock - 1);
      paint(false, null, true);
    }, settleIn);
  }

  /* Les annonces passent APRES le dessin : un mot ne doit jamais arriver avant
     l'image qu'il commente. */
  announce(fx);

  /* ⛔ PAS D'ANIMATION DE CHANGEMENT DE TOUR. Elle a ete essayee (vague sur la
     barre, puis sur les plateaux, puis en voile sombre sur toute la zone) :
     elle n'apporte rien, elle coupe le rythme, et elle masquait la destruction.
     Le tour se lit deja par la lumiere (le plateau qui a la main est eclaire,
     l'autre recule) et par la carte du joueur actif. */
}

/** `frozen` holds the seats whose board must wait — their dice are still exploding. */
function paint(full, frozen, settle) {
  if (!S.state || S.seat < 0) return;
  const st = S.state;
  const foe = 1 - S.seat;

  if (!frozen || !frozen.has(S.seat)) renderBoard(boardOf(S.seat), st.grids[S.seat], st.columnScores[S.seat], settle);
  if (!frozen || !frozen.has(foe)) renderBoard(boardOf(foe), st.grids[foe], st.columnScores[foe], settle);

  popChangedScores(st);
  renderPlayerCard('#dc-pc-me', st, S.seat, true);
  renderPlayerCard('#dc-pc-foe', st, foe, false);
  startClock(st);
  stageBoards(st);
  renderTurn(st);
  renderExit(st);
  renderCup(st);
  renderBonusRack();
  renderTargeting(st);
  renderArrondi(st);
  renderQuarters(st);
  renderBoost(st);
  renderBet(st, full);
}

/* A chaque instant UN SEUL plateau compte : celui qui a la main est eclaire,
   l'autre recule. C'est ce qui remplace « deux rectangles equivalents ». */
function stageBoards(st) {
  for (let seat = 0; seat < 2; seat++) {
    const board = boardOf(seat);
    const wrap = board && board.parentNode;
    if (!wrap || !wrap.classList.contains('dc-boardwrap')) continue;
    const live = st.phase === 'playing' && st.turn === seat;
    wrap.classList.toggle('dc-live', live);
    wrap.classList.toggle('dc-idle', st.phase === 'playing' && !live);
  }
}

/* Une plaque qui change de chiffre doit se faire remarquer : sans ca, le joueur
   ne voit jamais ce que son coup vient de rapporter. */
function popChangedScores(st) {
  if (!S.lastScores) S.lastScores = [[0, 0, 0], [0, 0, 0]];
  for (let seat = 0; seat < 2; seat++) {
    const board = boardOf(seat);
    if (!board || !board.parentNode) continue;
    for (let col = 0; col < 3; col++) {
      const value = st.columnScores[seat][col];
      if (value === S.lastScores[seat][col]) continue;
      S.lastScores[seat][col] = value;
      const plaque = board.parentNode.querySelector('.dc-colscore[data-col="' + col + '"]');
      if (!plaque || !value) continue;
      plaque.classList.remove('dc-plaque-pop');
      void plaque.offsetWidth;
      plaque.classList.add('dc-plaque-pop');
    }
  }
}

/*
 * Le portrait EST le capitaine choisi : le medaillon porte le liseré, le liseré
 * porte le trait. Un adversaire ne se reconnait plus a un visage tire de son
 * nom, mais a la facon dont il joue — ce qui est le sujet.
 */

/**
 * La cale a bonus, en pastilles.
 *
 * ⚠️ L'ADMIN NE VOYAIT PAS QUE L'IA EN AVAIT. Elle en jouait — le bandeau
 * l'annoncait au moment du coup — mais rien ne disait a l'avance qu'elle
 * pouvait le faire, si bien que son canon tombait du ciel. Deux ou trois
 * pastilles sous le nom suffisent : on sait ce qui peut arriver, donc on peut
 * jouer contre. Vide, la rangee disparait plutot que de montrer des trous.
 */
/**
 * Un objet de l'inventaire est-il JOUABLE en partie ?
 *
 * ⚠️ UNE PARURE N'EST PAS UN BONUS. L'inventaire porte tout ce que le joueur a
 * achete, jeux de des compris. Sans ce tri, un jeu de des apparaissait dans le
 * ratelier ET se comptait dans les pastilles sous le nom : le joueur voyait un
 * bonus qu'il n'avait jamais achete, appuyait dessus, et le serveur repondait
 * « unknown bonus ».
 *
 * La categorie vient du serveur. Quand elle manque — client plus recent que le
 * serveur, le temps d'un deploiement — l'identifiant tranche : les parures
 * commencent par S, les effets par B.
 */
function jouable(i) {
  return i.category ? i.category !== 'Skin' : !/^S\d/.test(i.identify || '');
}

function stockMarkup(st, seat) {
  /* ⚠️ LE SERVEUR COMPTE UN PLAFOND, PAS UNE CALE. `bonusStock` dit combien
     d'effets il reste le DROIT de jouer dans la partie — trois au depart, pour
     tout le monde. Un joueur qui n'a rien achete voyait donc trois pastilles
     sous son nom et cherchait des bonus qu'il n'avait pas. Pour son propre
     siege, on compte ce qu'il possede vraiment ; pour l'IA d'en face, le chiffre
     du serveur est le bon, c'est elle qui detient la reserve. */
  let n = (st.bonusStock && st.bonusStock[seat]) || 0;
  if (seat === S.seat) {
    const enCale = (S.inventory || []).filter(jouable)
      .reduce((t, i) => t + (i.quantity > 0 ? i.quantity : 0), 0)
      + ((st.freeReroll && st.freeReroll[seat]) ? 1 : 0);
    n = Math.min(n, enCale);
  }
  if (n <= 0) return '';
  /* ⚠️ `bonus1.png` EST LE NOM EN BASE, PAS LE NOM DU FICHIER. La table nomme
     les objets de gameplay ; les dessins vivent sous d'autres noms, et `bonusArt`
     fait la traduction. Ecrit en dur, le chemin donnait une image cassee — donc
     des pastilles presentes dans le DOM et invisibles a l'ecran. */
  const pastille = `<img class="dc-pc-chip" src="${bonusArt('B001')}" alt="">`;
  return `<div class="dc-pc-stock" title="${esc(t('bonus.left', { n }))}">${
    pastille.repeat(Math.min(n, 5))}</div>`;
}

function renderPlayerCard(sel, st, seat, isMe) {
  const p = st.players[seat] || {};
  const el = $(sel);
  if (!el) return;
  const active = st.turn === seat && st.phase === 'playing';
  const cap = st.captains ? st.captains[seat] : null;
  /* ⚠️ L'ANNEAU DECORATIF EST PARTI. C'etait un cordage dessine en CSS, cale a
     -17 % autour d'un portrait rond — mais le medaillon porte MAINTENANT son
     propre anneau, peint dans l'image. Les deux cercles ne coincidaient pas :
     « les cercles sont mal places », et on ne savait toujours pas qui jouait.
     A la place, un seul cercle, et il VEUT DIRE quelque chose : c'est le temps
     qu'il reste avant que l'IA prenne la main. */
  /* ⚠️ LES DEUX CARTES SE FONT DESORMAIS FACE, AUTOUR DU MEDAILLON. Le portrait
     se tourne vers le centre — a gauche pour l'adversaire, a droite pour soi —
     et le score se pose contre le medaillon : c'est la que les yeux vont pour
     comparer, et un ecart se lit alors sans traverser l'ecran.
     Le ratelier n'est plus ICI : il vit dans l'eventail de la cale, sinon il
     disputait sa largeur au nom et le coupait en quatre lignes. */
  el.className = 'dc-pc' + (isMe ? ' dc-pc-mine' : ' dc-pc-theirs')
               + (active ? ' dc-pc-active' : ' dc-pc-idle');
  el.innerHTML = `
    <div class="dc-pc-portrait">
      <img class="dc-pc-face" src="${captainArt(cap)}" alt="${esc(captainName(cap))}">
      <img class="dc-pc-trait" src="${traitArt(cap)}" alt="" title="${esc(captainTrait(cap))}">
      <span class="dc-pc-clock" aria-hidden="true"></span>
    </div>
    <div class="dc-pc-id">
      <div class="dc-pc-name">${esc(p.name || '?')}${p.ai ? ` <em>${esc(t('game.ai'))}</em>` : ''}</div>
      <div class="dc-pc-elo">${p.rating} ${esc(t('menu.elo'))}</div>
      ${stockMarkup(st, seat)}
      ${p.bet ? `<div class="dc-pc-bet">${esc(t('game.stake', { n: p.bet }))} <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>` : ''}
    </div>
    <div class="dc-pc-total" data-v="${st.totals[seat]}"
         aria-label="${esc(t(isMe ? 'game.yourScore' : 'game.theirScore'))}">${st.totals[seat]}</div>`;
}

/*
 * Une partie finie doit TOUJOURS avoir une sortie visible. La carte de resultat
 * peut etre fermee (bouton RETOUR d'Android), et le joueur se retrouvait alors
 * devant un plateau mort — vu sur le telephone de l'admin. Le bouton de la
 * barre laterale change donc de role a la fin : il ramene au pont.
 */
/* ─────────────────────────── la cale, en eventail ───────────────────────── */

/* ⚠️ LE RATELIER OCCUPAIT UNE PLACE PERMANENTE POUR RIEN. Il vivait dans la
   carte du joueur, lui disputait sa largeur et coupait les noms — « Ann / e /
   Bon / ny ». Ferme, il ne coute plus rien ; ouvert, il se deploie AU-DESSUS du
   bandeau, sans quoi le pouce qui l'ouvre le recouvrirait. */
function caleOuverte() {
  const rack = $('#dc-bonus');
  return !!(rack && rack.classList.contains('dc-bonus-open'));
}

function fermerCale() {
  const rack = $('#dc-bonus');
  if (rack) rack.classList.remove('dc-bonus-open');
  const sac = $('#dc-bag');
  if (sac) sac.classList.remove('dc-foot-on');
}

function basculerCale() {
  const rack = $('#dc-bonus');
  if (!rack) return;
  if (caleOuverte()) { fermerCale(); return; }
  renderBonusRack();
  if (!rack.children.length) { toast(t('bonus.empty'), 'warn'); return; }
  rack.classList.add('dc-bonus-open');
  const sac = $('#dc-bag');
  if (sac) sac.classList.add('dc-foot-on');
}

function renderExit(st) {
  const quit = $('#dc-quit');
  const replay = $('#dc-replay');
  if (!quit) return;
  const over = st.phase === 'over';
  /* ⚠️ ON NE TOUCHE PLUS AU CONTENU DE CE BOUTON : il porte une fleche, et lui
     ecrire un libelle par-dessus la remplacerait par le texte qu'on voulait
     justement eviter. Seul l'intitule d'accessibilite change de sens. */
  const dit = t(over ? 'over.back' : 'game.leave');
  quit.title = dit;
  quit.setAttribute('aria-label', dit);
  /* Le bandeau porte un libelle sous chaque dessin : celui de la sortie change
     de sens a la fin — on ne quitte plus une partie, on regagne le pont. */
  const mot = quit.querySelector('span');
  if (mot) mot.textContent = t(over ? 'foot.back' : 'foot.leave');

  /* ⚠️ REJOUER PREND LA PLACE DU GOBELET, IL NE S'AJOUTE PAS A COTE. Trois
     boutons tiennent dans le bandeau, quatre le compriment jusqu'a couper les
     libelles. Le gobelet n'a plus rien a lancer une fois la partie finie ; il
     s'efface et rend sa place. */
  const cup = $('#dc-cup');
  if (cup) cup.hidden = over;
  if (replay) replay.hidden = !over;
  /* La cale ne sert plus a rien quand tout est joue. */
  const sac = $('#dc-bag');
  if (sac) sac.hidden = over;
  if (over) fermerCale();

  /* « Rejouer » n'existe qu'a la fin : pendant la partie il n'a pas de sens, et
     un bouton visible mais inerte est pire qu'un bouton absent. */
  if (replay) {
    replay.classList.toggle('dc-quit-exit', over);
    replay.onclick = () => {
      const mode = (S.state && S.state.mode === 'duel') ? 'multi' : 'solo';
      if (UI.leaveMatch) UI.leaveMatch(); else UI.showMenu();
      if (S.net) S.net.send({ t: 'play', mode });
    };
  }
  /* ⚠️ Sur telephone ce bouton est masque pendant la partie (la barre laterale
     n'existe pas) : il doit REAPPARAITRE a la fin, sinon la sortie reste
     invisible la ou le probleme a ete constate. */
  quit.classList.toggle('dc-quit-exit', over);
  quit.onclick = over
    ? () => { if (UI.leaveMatch) UI.leaveMatch(); else UI.showMenu(); }
    : () => UI.requestClose();
}

function renderTurn(st) {
  /* ⚠️ UNE PARTIE EN PAUSE DOIT LE DIRE. Sans ce mot, un joueur dont
     l'adversaire vient d'etre coupe voit une table qui ne repond plus, sans
     savoir si c'est le jeu, son telephone, ou son tour. */
  if (st.paused) {
    const bar = $('#dc-turn');
    if (bar) { bar.textContent = t('game.paused'); bar.className = 'dc-turn dc-turn-paused'; }
    return;
  }
  const el = $('#dc-turn');
  if (!el) return;
  if (st.phase === 'betting') { el.textContent = t('game.placeStake'); el.className = 'dc-turn'; return; }
  if (st.phase === 'over') { el.textContent = t('game.matchOver'); el.className = 'dc-turn'; return; }
  const mine = st.turn === S.seat;
  el.textContent = mine ? t('game.yourTurn')
    : t('game.playing', { name: (st.players[st.turn] || {}).name || t('game.opponent') });
  el.className = 'dc-turn' + (mine ? ' dc-turn-mine' : '');
}

function renderCup(st) {
  const cup = $('#dc-cup');
  if (!cup) return;
  const die = st.dice[S.seat];
  const canRoll = st.phase === 'playing' && st.turn === S.seat && die === null;
  /* Le gobelet est LE MIEN : il montre donc mes des. */
  const ecrin = $('#dc-cup-slot') || cup;
  if (!S.rolling) ecrin.innerHTML = die === null ? cupArt(canRoll) : dieFace(die, false, skinOf(S.seat));
  cup.classList.toggle('dc-cup-ready', canRoll);
  cup.classList.toggle('dc-cup-armed', die !== null && st.turn === S.seat);
  cup.disabled = st.phase !== 'playing';

  /* ⚠️ LE DE ADVERSE SE POSAIT DANS LE COIN DE LA CARTE, JUSTE AU-DESSUS DU
     SCORE. Tant que le total tient sur un chiffre les deux boites se ratent ; a
     trois chiffres le score s'etend et passe dessous. On l'accroche au
     MEDAILLON : le portrait a une taille fixe, donc le de a une place fixe, et
     il ne peut plus rencontrer un chiffre quelle que soit sa longueur. */
  const foeDie = st.dice[1 - S.seat];
  const medaillon = $('#dc-pc-foe .dc-pc-portrait');
  if (medaillon && foeDie !== null) {
    const badge = document.createElement('div');
    badge.className = 'dc-foe-die';
    badge.innerHTML = dieFace(foeDie, false, skinOf(1 - S.seat));
    medaillon.appendChild(badge);
  }
  renderForesee(st, dieFace);
}

/**
 * Le ratelier vit DANS le bandeau du joueur, et il y est recree a chaque coup.
 *
 * ⚠️ `renderPlayerCard` refait son `innerHTML` : le conteneur du ratelier
 * dispararait donc a chaque etat recu. C'est pourquoi cette fonction est appelee
 * APRES elle dans `paint()` — l'ordre n'est pas cosmetique, il est structurel.
 */
export function renderBonusRack() {
  const rack = $('#dc-bonus');
  if (!rack || !S.state) return;
  const left = S.state.bonusLeft ? S.state.bonusLeft[S.seat] : 0;
  /* ⚠️ L'EFFET OFFERT PAR LE CAPITAINE N'EST PLUS FORCEMENT LA RELANCE.
     Chaque capitaine en offre un — relance, longue-vue ou benediction — et il
     apparait dans le ratelier meme sans jeton en cale, sinon le trait resterait
     invisible a qui n'a rien achete. Le serveur dit LEQUEL. */
  const offert = (S.state.freeBonus && S.state.freeBonus[S.seat]) || null;
  const owned = S.inventory.filter((i) => i.quantity > 0 && jouable(i));

  /* ⚠️ RIEN A MONTRER, DONC RIEN A L'ECRAN. Un bandeau « aucun bonus en cale »
     occupait une place permanente pour dire qu'il n'y avait rien a dire. */
  if (!owned.length && !offert) {
    rack.innerHTML = '';
    return;
  }
  /* L'effet offert ne se compte pas deux fois : s'il en reste aussi en cale, il
     n'apparait qu'une seule fois, gratuit — c'est celui-la qu'on depense d'abord. */
  const boutons = owned.filter((i) => i.identify !== offert);
  const bouton = (id, titre, badge, cadeau) => `
      <button class="dc-bonus-btn${cadeau ? ' dc-bonus-free' : ''}"
              data-id="${esc(id)}" data-nom="${esc(titre)}"
              title="${esc(titre)} — ${esc(t('bonus.left', { n: left }))}">
        <img src="${bonusArt(id)}" alt="">
        <span class="dc-bonus-qty">${esc(String(badge))}</span>
      </button>`;

  const tous = (offert ? [bouton(offert, t('shop.' + offert + '.name'), t('bonus.free'), true)] : [])
    .concat(boutons.map((i) => bouton(i.identify, i.description, i.quantity, false)));

  rack.innerHTML = tous.join('');

  /* ⚠️ UN BOUTON DESACTIVE NE DIT RIEN, ET SUR TELEPHONE IL NE DIT MEME PAS SON
     NOM : il n'y a pas de survol, donc pas d'infobulle. Le joueur appuyait sur un
     jeton grise sans savoir ni a quoi il sert, ni pourquoi il ne part pas. Le
     bouton reste donc VIVANT : il repond, et ce qu'il repond est la raison —
     exactement ce que fait deja le gobelet quand ce n'est pas votre tour. */
  rack.querySelectorAll('.dc-bonus-btn').forEach((b) => {
    const cadeau = b.classList.contains('dc-bonus-free');
    const epuise = left <= 0 && !cadeau;
    b.classList.toggle('dc-bonus-mute', !myTurn() || epuise);
    b.onclick = () => {
      const nom = b.dataset.nom || '';
      if (!myTurn()) { toast(nom + ' — ' + t('game.waitTurn'), 'warn'); return; }
      if (epuise) { toast(nom + ' — ' + t('bonus.left', { n: 0 }), 'warn'); return; }
      S.net.send({ t: 'bonus', identify: b.dataset.id });
    };
  });
}

/**
 * La colonne benie porte une marque, jusqu'a la fin.
 *
 * ⚠️ UN EFFET PERMANENT SANS TRACE VISIBLE N'EXISTE PAS POUR LE JOUEUR. Les
 * 15 % s'appliquaient bien au score, mais rien ne disait OU : on voyait un total
 * qui ne tombait pas juste, sans pouvoir refaire le calcul. La plaque de la
 * colonne le dit, des deux cotes — c'est une information publique, elle change
 * le calcul de l'adversaire aussi.
 */
/**
 * Les trois quarts du pont, sur les plaques de score.
 *
 * ⚠️ UNE REGLE QU'ON NE VOIT PAS N'EXISTE PAS. Le multiplicateur change chaque
 * pose, mais il ne change RIEN au comportement du joueur tant qu'il n'est pas
 * lisible sur la colonne qu'il pondere. On l'ecrit donc a l'endroit ou l'on
 * regarde deja le score, et des deux cotes — c'est une information publique, elle
 * pese sur le calcul de l'adversaire autant que sur le sien.
 */
/**
 * Chaque plateau cale l'arrondi de ses logements sur les dés qu'il accueille.
 *
 * ⚠️ UNE VALEUR UNIQUE NE PEUT PAS CONVENIR À SIX JEUX. Les arrondis livrés vont
 * de 16 % à 26 % : un logement figé laisse des coins vides autour des uns et
 * mord sur les autres. La valeur descend donc du plateau, par variable CSS.
 */
function renderArrondi(st) {
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (!board) return;
    board.style.setProperty('--pd-cell-round',
      (arrondiDeCase(skinOf(seat)) * 100).toFixed(2) + '%');
  });
}

function renderQuarters(st) {
  const q = st.quarters;
  if (!q) return;
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (!board || !board.parentNode) return;
    board.parentNode.querySelectorAll('.dc-colscore').forEach((plaque) => {
      const col = parseInt(plaque.dataset.col, 10);
      const m = q[col];
      if (typeof m !== 'number') return;
      /* On n'ecrit rien sur une colonne neutre : un « x1 » partout ne dit rien
         et vole la place des deux qui comptent. */
      plaque.dataset.quart = m === 1 ? '' : ('×' + String(m).replace('.', ','));
      plaque.classList.toggle('dc-colscore-riche', m > 1);
      plaque.classList.toggle('dc-colscore-pauvre', m < 1);
    });
  });
}

function renderBoost(st) {
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (!board || !board.parentNode) return;
    const beni = (st.boostCol && st.boostCol[seat]);
    board.parentNode.querySelectorAll('.dc-colscore').forEach((plaque) => {
      const col = parseInt(plaque.dataset.col, 10);
      plaque.classList.toggle('dc-colscore-boost', col === beni && beni >= 0);
      if (col === beni && beni >= 0) plaque.title = t('fx.boost');
    });
  });
}

function renderTargeting(st) {
  const game = $('#dc-screen-game');
  const pending = st.pending && st.pending.seat === S.seat ? st.pending : null;
  game.classList.toggle('dc-targeting', !!pending);
  /* ⚠️ UNE BENEDICTION VISE UNE COLONNE, PAS UNE CASE — et une colonne VIDE est
     une cible parfaitement valable, c'est meme le pari le plus interessant. Les
     regles de ciblage n'allumaient que les cases occupees : sur un plateau neuf,
     l'effet aurait ete impossible a poser. */
  game.classList.toggle('dc-targeting-col', !!(pending && pending.column));
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (board) board.classList.toggle('dc-target', !!pending && pending.target === seat);
  });
  if (pending) {
    const turn = $('#dc-turn');
    if (turn) turn.textContent = t('game.pickBlast');
  }
}

/**
 * La pluie de doublons de la victoire. Elle dure 4,1 s (33 images).
 *
 * ⚠️ Elle est portee par un PSEUDO-ELEMENT et REPOSEE tant que la fenetre de
 * victoire dure : en simple enfant elle disparaissait au bout d'une seconde,
 * emportee par un re-rendu de l'ecran de fin — on ne voyait qu'un quart de
 * l'animation. Reposer la classe est insensible a la cause du nettoyage.
 */
function rain(el) {
  const src = "url('" + fxUrl('fx_win.png', 5200) + "')";
  const until = Date.now() + 4300;
  const keep = setInterval(() => {
    if (Date.now() > until || !el.classList.contains('on')) {
      clearInterval(keep);
      el.classList.remove('dc-rain');
      return;
    }
    if (!el.classList.contains('dc-rain')) {
      el.style.setProperty('--dc-win-img', src);
      el.classList.add('dc-rain');
    }
  }, 200);
  el.style.setProperty('--dc-win-img', src);
  el.classList.add('dc-rain');
}

