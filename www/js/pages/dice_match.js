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
import { buildBoard, renderBoard, markPlaced, blastCells, cupArt, dieFace,
         tumble, showLanding, clearLanding, freeCellOf } from './dice_board.js';

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
  if (rolled) S.sfx.play('roll', 0.3);

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

  if (placed) { S.sfx.play('drop', 0.25); markPlaced(boardOf(placed.seat), placed.cell); }

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

/* Le meme adversaire garde TOUJOURS le meme visage : on tire le portrait de son
   nom, pas du hasard, sinon « Bobby » changerait de tete a chaque partie. */
function portraitOf(player) {
  if (!player || !player.ai) return 'avatar_player.png';
  const name = player.name || '';
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum = (sum * 31 + name.charCodeAt(i)) % 997;
  return 'avatar_ai_' + (1 + (sum % 4)) + '.png';
}

function renderPlayerCard(sel, st, seat, isMe) {
  const p = st.players[seat] || {};
  const el = $(sel);
  if (!el) return;
  const active = st.turn === seat && st.phase === 'playing';
  el.className = 'dc-pc pd-panel' + (active ? ' dc-pc-active' : '');
  el.innerHTML = `
    <div class="dc-pc-portrait">
      <img class="dc-pc-face" src="${ASSETS}img/${portraitOf(p)}" alt="">
      ${active ? '<span class="dc-pc-ring"></span>' : ''}
    </div>
    <div class="dc-pc-name">${esc(p.name || '?')}${p.ai ? ` <em>${esc(t('game.ai'))}</em>` : ''}</div>
    <div class="dc-pc-elo">${p.rating} ${esc(t('menu.elo'))}</div>
    <div class="dc-pc-total" data-v="${st.totals[seat]}">${st.totals[seat]}</div>
    <div class="dc-pc-lbl">${esc(t(isMe ? 'game.yourScore' : 'game.theirScore'))}</div>
    ${p.bet ? `<div class="dc-pc-bet">${esc(t('game.stake', { n: p.bet }))} <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>` : ''}`;
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
}

export function renderBonusRack() {
  const rack = $('#dc-bonus');
  if (!rack || !S.state) return;
  const left = S.state.bonusLeft ? S.state.bonusLeft[S.seat] : 0;
  const owned = S.inventory.filter((i) => i.quantity > 0);

  if (!owned.length) {
    rack.innerHTML = '<div class="dc-bonus-empty">' + esc(t('bonus.empty')) + '</div>';
    return;
  }
  rack.innerHTML = `<div class="dc-bonus-hd">${esc(t('bonus.head'))} <span>${esc(t('bonus.left', { n: left }))}</span></div>` +
    owned.map((i) => `
      <button class="dc-bonus-btn" data-id="${esc(i.identify)}" title="${esc(i.description)}">
        <img src="${bonusArt(i.identify)}" alt="">
        <span class="dc-bonus-qty">${i.quantity}</span>
      </button>`).join('');

  rack.querySelectorAll('.dc-bonus-btn').forEach((b) => {
    b.disabled = !myTurn() || left <= 0;
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

/*
 * LES MONTANTS PRETS. Sur un telephone, taper un nombre ouvre le clavier, qui
 * recouvre la moitie de l'ecran au moment precis ou le joueur veut juste dire
 * « je mise 50 ». Quatre jetons couvrent tous les cas usuels ; le champ reste
 * la pour qui veut un montant exact.
 */
function betChips(purse) {
  const out = [{ value: 0, label: t('bet.none') }];
  for (const value of [10, 50, 100, 250]) {
    if (value <= purse) out.push({ value, label: String(value) });
  }
  if (purse > 0) out.push({ value: purse, label: t('bet.all') });
  return out;
}

function renderBet(st, full) {
  const bet = $('#dc-bet');
  if (!bet) return;
  if (st.phase !== 'betting') { bet.classList.remove('on'); return; }
  bet.classList.add('on');

  if (!full && bet.dataset.ready === '1') return;
  bet.dataset.ready = '1';
  const purse = S.me ? S.me.coins : 0;
  bet.innerHTML = `
    <div class="dc-bet-card pd-panel">
      <img class="dc-bet-art" src="${ASSETS}img/ornament_stake.png" alt="">
      <h3>${esc(t('bet.title'))}</h3>
      <p>${esc(t('bet.hint'))}</p>
      <div class="dc-bet-chips">${betChips(purse).map((c) => `
        <button class="dc-chip" data-bet="${c.value}">${esc(c.label)}</button>`).join('')}
      </div>
      <div class="dc-bet-row">
        <input type="number" id="dc-bet-input" min="0" step="10" value="0" max="${purse}" aria-label="stake">
        <span class="dc-bet-max">${esc(t('bet.of', { n: purse }))} <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></span>
      </div>
      <button class="dc-btn" id="dc-bet-go">${esc(t('bet.lock'))}</button>
      <div class="dc-bet-wait"></div>
    </div>`;
  const field = $('#dc-bet-input');
  bet.querySelectorAll('.dc-chip').forEach((chip) => {
    chip.onclick = () => {
      field.value = chip.dataset.bet;
      bet.querySelectorAll('.dc-chip').forEach((c) => c.classList.toggle('on', c === chip));
    };
  });

  $('#dc-bet-go').onclick = () => {
    const value = parseInt($('#dc-bet-input').value, 10);
    S.net.send({ t: 'bet', value: Number.isFinite(value) ? value : 0 });
    $('#dc-bet-go').disabled = true;
    bet.querySelector('.dc-bet-wait').textContent = t('bet.waiting');
  };
}
