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
import { S, UI, ASSETS, screen, boardOf, myTurn, bonusArt, fxUrl } from './dice_state.js';
import { t } from '../core/i18n.js';
import { renderBet } from './dice_end.js';
import { buildBoard, renderBoard, markPlaced, blastCells, cupArt, dieFace,
         tumble, showLanding, clearLanding, freeCellOf } from './dice_board.js';
import { announce, renderForesee } from './dice_fx.js';
import { captainArt, traitArt, captainName, captainTrait } from './dice_lobby.js';

export function onMatch(m) {
  S.queued = false;
  S.lastScores = null;
  S.seat = m.seat;
  S.state = m.state;
  buildGame();
  screen('game');
  paint(true);
}

function buildGame() {
  const el = $('#dc-screen-game');
  el.innerHTML = `
    <div class="dc-arena">
      <div class="dc-side dc-side-foe"><div class="dc-pc pd-panel" id="dc-pc-foe"></div></div>
      <div class="dc-boards">
        <div class="dc-board-slot" id="dc-slot-foe"></div>
        <div class="dc-mid pd-panel">
          <div class="dc-turn" id="dc-turn"></div>
          <button class="dc-cup" id="dc-cup" title="${esc(t('hdr.roll'))}"></button>
        </div>
        <div class="dc-board-slot" id="dc-slot-me"></div>
      </div>
      <!-- Le ratelier vit DANS L'ARENE, pas dans la barre du tour : enfant de la
           barre, il etait positionne par rapport a elle et rogne par son overflow. -->
      <div class="dc-bonus pd-panel" id="dc-bonus"></div>
      <div class="dc-side dc-side-me">
        <div class="dc-pc pd-panel" id="dc-pc-me"></div>
        <button class="dc-btn dc-btn-ghost dc-quit" id="dc-quit">${esc(t('game.leave'))}</button>
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
        if (!box.classList.contains('dc-cell-filled')) return;
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
    const cup = $('#dc-cup');
    if (cup) tumble(cup, rolled.value, () => { S.rolling = false; if (S.state) renderCup(S.state); });
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
  stageBoards(st);
  renderTurn(st);
  renderExit(st);
  renderCup(st);
  renderBonusRack();
  renderTargeting(st);
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
function renderPlayerCard(sel, st, seat, isMe) {
  const p = st.players[seat] || {};
  const el = $(sel);
  if (!el) return;
  const active = st.turn === seat && st.phase === 'playing';
  const cap = st.captains ? st.captains[seat] : null;
  el.className = 'dc-pc pd-panel' + (active ? ' dc-pc-active' : '');
  el.innerHTML = `
    <div class="dc-pc-portrait">
      <img class="dc-pc-face" src="${captainArt(cap)}" alt="${esc(captainName(cap))}">
      ${active ? '<span class="dc-pc-ring"></span>' : ''}
      <img class="dc-pc-trait" src="${traitArt(cap)}" alt="" title="${esc(captainTrait(cap))}">
    </div>
    <div class="dc-pc-name">${esc(p.name || '?')}${p.ai ? ` <em>${esc(t('game.ai'))}</em>` : ''}</div>
    <div class="dc-pc-elo">${p.rating} ${esc(t('menu.elo'))}</div>
    <div class="dc-pc-total" data-v="${st.totals[seat]}">${st.totals[seat]}</div>
    <div class="dc-pc-lbl">${esc(t(isMe ? 'game.yourScore' : 'game.theirScore'))}</div>
    ${p.bet ? `<div class="dc-pc-bet">${esc(t('game.stake', { n: p.bet }))} <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>` : ''}`;
}

/*
 * Une partie finie doit TOUJOURS avoir une sortie visible. La carte de resultat
 * peut etre fermee (bouton RETOUR d'Android), et le joueur se retrouvait alors
 * devant un plateau mort — vu sur le telephone de l'admin. Le bouton de la
 * barre laterale change donc de role a la fin : il ramene au pont.
 */
function renderExit(st) {
  const quit = $('#dc-quit');
  if (!quit) return;
  const over = st.phase === 'over';
  quit.textContent = t(over ? 'over.back' : 'game.leave');
  quit.classList.toggle('dc-btn-ghost', !over);
  /* ⚠️ Sur telephone ce bouton est masque pendant la partie (la barre laterale
     n'existe pas) : il doit REAPPARAITRE a la fin, sinon la sortie reste
     invisible la ou le probleme a ete constate. */
  quit.classList.toggle('dc-quit-exit', over);
  quit.onclick = over
    ? () => { if (UI.leaveMatch) UI.leaveMatch(); else UI.showMenu(); }
    : () => UI.requestClose();
}

function renderTurn(st) {
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
  if (!S.rolling) cup.innerHTML = die === null ? cupArt(canRoll) : dieFace(die);
  cup.classList.toggle('dc-cup-ready', canRoll);
  cup.classList.toggle('dc-cup-armed', die !== null && st.turn === S.seat);
  cup.disabled = st.phase !== 'playing';

  const foeDie = st.dice[1 - S.seat];
  const foeCard = $('#dc-pc-foe');
  if (foeCard && foeDie !== null) {
    const badge = document.createElement('div');
    badge.className = 'dc-foe-die';
    badge.innerHTML = dieFace(foeDie);
    foeCard.appendChild(badge);
  }
  renderForesee(st, dieFace);
}

export function renderBonusRack() {
  const rack = $('#dc-bonus');
  if (!rack || !S.state) return;
  const left = S.state.bonusLeft ? S.state.bonusLeft[S.seat] : 0;
  /* La relance de Mary Read ne coute rien : elle apparait dans le ratelier meme
     sans jeton en cale, sinon le trait resterait invisible a qui n'a rien achete. */
  const gratuite = !!(S.state.freeReroll && S.state.freeReroll[S.seat]);
  const owned = S.inventory.filter((i) => i.quantity > 0);

  if (!owned.length && !gratuite) {
    rack.innerHTML = '<div class="dc-bonus-empty">' + esc(t('bonus.empty')) + '</div>';
    return;
  }
  const boutons = owned.filter((i) => !(gratuite && i.identify === 'B001'));
  rack.innerHTML = `<div class="dc-bonus-hd">${esc(t('bonus.head'))} <span>${esc(t('bonus.left', { n: left }))}</span></div>`
    + (gratuite ? `
      <button class="dc-bonus-btn dc-bonus-free" data-id="B001" title="${esc(t('cap.read.trait'))}">
        <img src="${bonusArt('B001')}" alt="">
        <span class="dc-bonus-qty">${esc(t('bonus.free'))}</span>
      </button>` : '')
    + boutons.map((i) => `
      <button class="dc-bonus-btn" data-id="${esc(i.identify)}" title="${esc(i.description)}">
        <img src="${bonusArt(i.identify)}" alt="">
        <span class="dc-bonus-qty">${i.quantity}</span>
      </button>`).join('');

  rack.querySelectorAll('.dc-bonus-btn').forEach((b) => {
    b.disabled = !myTurn() || (left <= 0 && !b.classList.contains('dc-bonus-free'));
    b.onclick = () => S.net.send({ t: 'bonus', identify: b.dataset.id });
  });
}

function renderTargeting(st) {
  const game = $('#dc-screen-game');
  const pending = st.pending && st.pending.seat === S.seat ? st.pending : null;
  game.classList.toggle('dc-targeting', !!pending);
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

