/* ============================================================================
   pages/dice.js — "The Pirate's Dice" inside Reforged Studio: the shell.

   The game runs in ONE overlay (`#dicewrap`, built here) that can be blown up to
   full screen. It is deliberately NOT a `.modal`: the global Escape handler in
   ui/dialogs.js closes the top-most `.modal` without asking, and leaving a live
   match forfeits it — so this overlay owns its own Escape and asks first.

   This file owns the frame (header, wallet, menu, side panels, connection); the
   table itself lives in dice_match.js and the shared state in dice_state.js.
   No rule, score or coin is decided here: the server (dice_server/) is the only
   authority, and this is the screen it talks to.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/toast.js';
import { uiConfirm } from '../ui/dialogs.js';
import { DiceNet, diceStatus } from './dice_net.js';
import { Sfx } from './dice_board.js';
import { S, UI, ASSETS, screen, bonusArt, preloadAssets } from './dice_state.js';
import { onMatch, onState, renderBonusRack } from './dice_match.js';
import { onOver } from './dice_end.js';
import { renderRules, renderShop, renderRanking } from './dice_panels.js';

function shellMarkup() {
  return `
  <div class="dc-shell">
    <header class="dc-top">
      <div class="dc-brand"><img class="dc-brand-mark" src="${ASSETS}img/brand_mark.png" alt=""> ${esc(t('app.title'))}</div>
      <div class="dc-wallet" id="dc-wallet"></div>
      <nav class="dc-tabs">
        <button class="dc-tab" data-panel="shop"><img src="${ASSETS}img/icon_shop.png" alt=""> ${esc(t('tab.shop'))}</button>
        <button class="dc-tab" data-panel="ranking"><img src="${ASSETS}img/icon_ranking.png" alt=""> ${esc(t('tab.ranking'))}</button>
        <button class="dc-tab" data-panel="rules"><img src="${ASSETS}img/icon_rules.png" alt=""> ${esc(t('tab.rules'))}</button>
      </nav>
      <div class="dc-acts">
        <button class="dc-icon" id="dc-mute" title="${esc(t('hdr.mute'))}"><img src="${ASSETS}img/icon_sound.png" alt=""></button>
        <button class="dc-icon" id="dc-full" title="${esc(t('hdr.full'))}"><img src="${ASSETS}img/icon_expand.png" alt=""></button>
        <button class="dc-icon dc-icon-close" id="dc-close" title="${esc(t('hdr.close'))}"><img src="${ASSETS}img/icon_close.png" alt=""></button>
      </div>
    </header>
    <div class="dc-body">
      <video class="dc-bgvideo" id="dc-bgvideo" poster="${ASSETS}img/bg.jpg"
             muted loop playsinline preload="auto" tabindex="-1" aria-hidden="true">
        <source src="${ASSETS}img/bg.mp4" type="video/mp4">
      </video>
      <section class="dc-screen" id="dc-screen-connect"></section>
      <section class="dc-screen" id="dc-screen-menu"></section>
      <section class="dc-screen" id="dc-screen-game"></section>
      <aside class="dc-panel" id="dc-panel"><div class="dc-panel-in"></div></aside>
      <div class="dc-over" id="dc-over"></div>
    </div>
  </div>`;
}

function build() {
  if (S.built) return;
  const wrap = $('#dicewrap');
  wrap.innerHTML = shellMarkup();

  S.sfx = new Sfx(ASSETS + 'sfx/');
  S.sfx.load('roll', 'diceDrop.mp3');
  S.sfx.load('drop', 'dropCoin.mp3');
  S.sfx.load('boom', 'boom.mp3');
  S.sfx.load('start', 'begin.mp3');
  S.sfx.load('open', 'rulesBookSound.mp3');
  S.sfx.load('shut', 'closeRulesBook.mp3');

  $('#dc-close').onclick = () => requestClose();
  $('#dc-full').onclick = () => toggleFull();
  $('#dc-mute').onclick = () => {
    S.sfx.muted = !S.sfx.muted;
    $('#dc-mute').classList.toggle('dc-icon-off', S.sfx.muted);
    $('#dc-mute').title = t(S.sfx.muted ? 'hdr.unmute' : 'hdr.mute');
  };
  wrap.querySelectorAll('.dc-tab').forEach((b) => { b.onclick = () => togglePanel(b.dataset.panel); });

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('fullscreenchange', syncFull);
  S.built = true;
}

/**
 * Le fond anime ne tourne QUE pendant qu'on joue. Sans ca, un tool laisse ouvert
 * decode une video en boucle toute la journee pour un ecran que personne ne
 * regarde. `prefers-reduced-motion` le laisse sur son image fixe (le poster).
 */
function playBackdrop(on) {
  const video = $('#dc-bgvideo');
  if (!video) return;
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (on && !still) {
    const p = video.play();
    if (p && p.catch) p.catch(() => { /* lecture refusee : le poster fait le fond */ });
  } else {
    try { video.pause(); } catch (_) { /* deja arrete */ }
  }
}

/* ────────────────────────────────────────────────────────── open / close ── */

export async function openDice() {
  build();
  /* Les planches d'effets et les faces de des sont tirees MAINTENANT : la
     premiere explosion d'une partie ne doit pas attendre un telechargement. */
  preloadAssets();
  const wrap = $('#dicewrap');
  wrap.classList.add('open');
  wrap.setAttribute('aria-hidden', 'false');
  S.open = true;
  playBackdrop(true);
  if (S.net && S.net.ready) { showMenu(); return; }
  await connect();
}

async function connect() {
  screen('connect');
  $('#dc-screen-connect').innerHTML =
    '<div class="dc-connect"><div class="dc-wheel"></div>'
    + '<p>' + esc(t('connect.boarding')) + '</p></div>';

  S.net = new DiceNet({
    welcome: (m) => {
      S.me = m.me; S.inventory = m.inventory || []; S.shop = m.shop || [];
      S.rules = m.rules || S.rules;
      renderWallet();
      showMenu();
    },
    me: (m) => {
      S.me = m.me; S.inventory = m.inventory || [];
      renderWallet(); refreshPanel(); renderBonusRack();
    },
    queued: () => { S.queued = true; showMenu(); },
    idle: () => { S.queued = false; S.seat = -1; S.state = null; showMenu(); },
    match: onMatch,
    state: onState,
    over: onOver,
    error: (m) => toast(m.msg || 'refused', 'warn'),
    denied: (m) => connectFailed(m.msg || 'the game server refused the token'),
    closed: (byUs) => { if (!byUs && S.open) connectFailed('the connection to the game server dropped'); },
  });

  try { await S.net.connect(); }
  catch (e) { connectFailed(e.message); }
}

async function connectFailed(message) {
  screen('connect');
  const probe = await diceStatus();
  const where = (probe && probe.url) || 'the dev server';
  /* Dire PAR OU on a essaye : sur le LAN c'est l'adresse du service, ailleurs
     c'est le tunnel SSH du tool. Sans ca, « tried 127.0.0.1:62725 » n'aide personne. */
  const route = probe && probe.route;
  const how = route === 'ssh' ? t('connect.viaSsh')
    : (route === 'unreachable' ? t('connect.noSsh') : '');
  const fix = route === 'unreachable' ? esc(t('connect.fixSsh'))
    : t('connect.fixTool', { cmd: '<code>python dice_server/deploy/deploy.py</code>',
                             logs: '<code>--logs</code>' });
  $('#dc-screen-connect').innerHTML = `
    <div class="dc-connect dc-connect-bad">
      <img class="dc-connect-icon" src="${ASSETS}img/icon_anchor.png" alt="">
      <h3>${esc(t('connect.outOfReach'))}</h3>
      <p class="dc-connect-why">${esc(message)}</p>
      <p class="dc-connect-where">${t('connect.tried', { url: '<code>' + esc(where) + '</code>' })}${esc(how)}${probe && probe.error ? ' — ' + esc(probe.error) : ''}</p>
      <p class="dc-connect-fix">${fix}</p>
      <button class="dc-btn" id="dc-retry">${esc(t('connect.retry'))}</button>
    </div>`;
  const retry = $('#dc-retry');
  if (retry) retry.onclick = () => connect();
}

function requestClose() {
  const live = S.state && S.state.phase !== 'over';
  if (!live) return closeDice();
  uiConfirm(t('game.leaveConfirm'), t('game.leaveTitle'), t('game.leaveOk'))
    .then((yes) => { if (yes) { if (S.net) S.net.send({ t: 'leave' }); closeDice(); } });
  return undefined;
}

function closeDice() {
  const wrap = $('#dicewrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  wrap.setAttribute('aria-hidden', 'true');
  S.open = false;
  playBackdrop(false);
  S.panel = null;
  S.state = null;
  S.seat = -1;
  if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (_) { /* refused */ } }
  wrap.classList.remove('dc-full');
  if (S.net) { S.net.close(); S.net = null; }
}

function onKey(ev) {
  if (!S.open) return;
  const dialogOpen = !!document.querySelector('.modal.open');

  if (ev.key === 'Escape') {
    if (dialogOpen) return;                        // a confirm sits on top: it owns Escape
    ev.preventDefault(); ev.stopPropagation();
    if (S.panel) { togglePanel(S.panel); return; }
    requestClose();
    return;
  }
  if (dialogOpen) return;

  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (!S.state || S.state.phase !== 'playing' || S.state.turn !== S.seat) return;

  if (ev.key === ' ' || ev.key === 'r' || ev.key === 'R') {
    if (S.state.dice[S.seat] === null) { ev.preventDefault(); S.net.send({ t: 'roll' }); }
    return;
  }
  if (['1', '2', '3'].includes(ev.key) && S.state.dice[S.seat] !== null) {
    ev.preventDefault();
    S.net.send({ t: 'place', column: parseInt(ev.key, 10) - 1 });
  }
}

function toggleFull() {
  const wrap = $('#dicewrap');
  const goingFull = !wrap.classList.contains('dc-full');
  wrap.classList.toggle('dc-full', goingFull);
  if (goingFull) {
    const p = wrap.requestFullscreen && wrap.requestFullscreen();
    // The host webview may refuse: the CSS state already fills the window, so this is not an error.
    if (p && p.catch) p.catch(() => { });
  } else if (document.fullscreenElement) {
    try { document.exitFullscreen(); } catch (_) { /* refused */ }
  }
  $('#dc-full').title = t(goingFull ? 'hdr.exitFull' : 'hdr.full');
}

function syncFull() {
  const wrap = $('#dicewrap');
  if (!wrap) return;
  if (!document.fullscreenElement && S.wasNativeFull) wrap.classList.remove('dc-full');
  S.wasNativeFull = !!document.fullscreenElement;
}

/* ─────────────────────────────────────────────────────────── wallet / menu ── */

function renderWallet() {
  if (!S.me) return;
  $('#dc-wallet').innerHTML = `
    <img class="dc-avatar" src="${ASSETS}img/avatar.png" alt="">
    <div class="dc-wallet-txt">
      <b>${esc(S.me.name)}</b>
      <span>${esc(t('hdr.record', { rating: S.me.rating, wins: S.me.wins, losses: S.me.losses, draws: S.me.draws }))}</span>
    </div>
    <div class="dc-coins" title="${esc(t('hdr.coins'))}">${S.me.coins}
      <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>`;
}

function showMenu() {
  screen('menu');
  const el = $('#dc-screen-menu');

  if (S.queued) {
    el.innerHTML = `
      <div class="dc-menu"><div class="dc-menu-card pd-panel">
        <div class="dc-wheel"></div>
        <h3>${esc(t('menu.waiting'))}</h3>
        <p>${esc(t('menu.waitingHint'))}</p>
        <button class="dc-btn dc-btn-ghost" id="dc-unqueue">${esc(t('menu.cancel'))}</button>
      </div></div>`;
    $('#dc-unqueue').onclick = () => S.net.send({ t: 'cancel' });
    return;
  }

  el.innerHTML = `
    <div class="dc-menu"><div class="dc-menu-card pd-panel">
      <h2>${esc(t('menu.title'))}</h2>
      <p>${esc(t('menu.pitch'))}</p>
      <div class="dc-menu-btns">
        <button class="dc-btn dc-btn-big" id="dc-solo">${esc(t('menu.solo'))}</button>
        <button class="dc-btn dc-btn-big dc-btn-alt" id="dc-multi">${esc(t('menu.multi'))}</button>
      </div>
      <div class="dc-menu-stats">
        <span><b>${S.me ? S.me.games : 0}</b> ${esc(t('menu.matches'))}</span>
        <span><b>${S.me ? S.me.rating : 0}</b> ${esc(t('menu.elo'))}</span>
        <span><b>${S.me ? S.me.coins : 0}</b> ${esc(t('menu.coins'))}</span>
      </div>
    </div></div>`;
  $('#dc-solo').onclick = () => { S.sfx.play('start', 0.25); S.net.send({ t: 'play', mode: 'solo' }); };
  $('#dc-multi').onclick = () => S.net.send({ t: 'play', mode: 'multi' });
}

/* ─────────────────────────────────────────────── shop / ranking / rules ── */

function togglePanel(name) {
  const panel = $('#dc-panel');
  if (S.panel === name) {
    S.panel = null;
    panel.classList.remove('on');
    S.sfx.play('shut', 0.2);
  } else {
    S.panel = name;
    panel.classList.add('on');
    S.sfx.play('open', 0.2);
    refreshPanel();
  }
  $('#dicewrap').querySelectorAll('.dc-tab')
    .forEach((b) => b.classList.toggle('on', b.dataset.panel === S.panel));
}

function refreshPanel() {
  if (!S.panel) return;
  const body = $('#dc-panel .dc-panel-in');
  if (S.panel === 'rules') renderRules(body);
  else if (S.panel === 'shop') renderShop(body);
  else if (S.panel === 'ranking') renderRanking(body);
}

/* ───────────────────────────────────────────────────────────────── wiring ── */

export function initDice() {
  UI.showMenu = showMenu;
  UI.renderWallet = renderWallet;
  UI.requestClose = requestClose;
}
