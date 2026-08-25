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
import { renderMenu, onRoom, onRoomFail, resetLobby, captainArt } from './dice_lobby.js';

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
        <!-- Un GRELOT ne dit pas « son coupe » : il dit « notification ». Le
             haut-parleur, lui, se lit sans legende, et sa version barree dit
             l'etat coupe sans qu'on ait a comparer deux nuances de gris. -->
        <button class="dc-icon" id="dc-mute" title="${esc(t('hdr.mute'))}"><img src="${ASSETS}img/icon_sound_on.png" alt=""></button>
        <button class="dc-icon" id="dc-full" title="${esc(t('hdr.full'))}"><img src="${ASSETS}img/icon_expand.png" alt=""></button>
        <button class="dc-icon dc-icon-close" id="dc-close" title="${esc(t('hdr.close'))}"><img src="${ASSETS}img/icon_close.png" alt=""></button>
      </div>
    </header>
    <div class="dc-body">
      <!-- ⛔ Plus de video de fond : le decor est du CSS. Elle decodait 536 Ko en
           boucle pour une taverne qui n'existe plus. -->
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
  /* ⚠️ `coin` est le son des PIECES (achat, gain), `dice` celui du DE. La pose
     d'un de jouait dropCoin.mp3 : on entendait de la monnaie tomber sur le
     plateau. Les noms disent maintenant ce qu'ils sont. */
  S.sfx.load('dice', 'diceDrop.mp3');
  S.sfx.load('coin', 'dropCoin.mp3');
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
    const hp = $('#dc-mute img');
    if (hp) hp.src = ASSETS + 'img/icon_sound_' + (S.sfx.muted ? 'off' : 'on') + '.png';
  };
  wrap.querySelectorAll('.dc-tab').forEach((b) => { b.onclick = () => togglePanel(b.dataset.panel); });

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('fullscreenchange', syncFull);
  S.built = true;
}

/* ────────────────────────────────────────────────────────── open / close ── */

/* Le reseau revient, ou l'application repasse au premier plan : ce sont les deux
   instants ou une tentative aboutit. On ne les laisse pas passer. */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (S.open && !S.net) { arreterRelance(); connect(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && S.open && !S.net) { arreterRelance(); connect(); }
  });
}

export async function openDice() {
  build();
  /* Les planches d'effets et les faces de des sont tirees MAINTENANT : la
     premiere explosion d'une partie ne doit pas attendre un telechargement. */
  preloadAssets();
  const wrap = $('#dicewrap');
  wrap.classList.add('open');
  wrap.setAttribute('aria-hidden', 'false');
  S.open = true;
  if (S.net && S.net.ready) { showMenu(); return; }
  await connect();
}

async function connect() {
  screen('connect');
  $('#dc-screen-connect').innerHTML =
    '<div class="dc-connect"><img class="dc-wheel" src="' + ASSETS + 'img/icon_loader.png" alt="">'
    + '<p>' + esc(t('connect.boarding')) + '</p></div>';

  S.net = new DiceNet({
    welcome: (m) => {
      /* On est passe : l'attente repart de zero pour la prochaine coupure. */
      arreterRelance();
      S.me = m.me; S.inventory = m.inventory || []; S.shop = m.shop || [];
      S.rules = m.rules || S.rules;
      renderWallet();
      showMenu();
    },
    me: (m) => {
      S.me = m.me; S.inventory = m.inventory || [];
      renderWallet(); refreshPanel(); renderBonusRack();
    },
    captains: () => { /* la liste du serveur : le client a deja la sienne */ },
    queued: () => { S.queued = true; showMenu(); },
    idle: () => { S.queued = false; S.seat = -1; S.state = null; showMenu(); },
    room: (m) => onRoom(m, $('#dc-screen-menu')),
    roomfail: onRoomFail,
    match: (m) => { resetLobby(); onMatch(m); },
    state: onState,
    over: onOver,
    /* ⚠️ UN REFUS DU SERVEUR DOIT RENDRE LA MAIN, PAS SEULEMENT PARLER.
       L'ecran de mise se desactivait a l'envoi ; un refus affichait bien son
       toast, mais aucun etat ne suivait, donc rien ne rallumait le bouton et
       la partie semblait morte. Et le message arrivait en anglais brut au
       milieu d'un jeu en francais. */
    error: (m) => { toast(messageServeur(m.msg), 'warn'); rendreLaMain(); },
    denied: (m) => connectFailed(m.msg || 'the game server refused the token'),
    closed: (byUs) => {
      /* ⚠️ `S.net` DOIT TOMBER AVEC LA CONNEXION. La relance automatique et les
         panneaux verifient sa presence pour savoir s'ils peuvent parler : le
         laisser en place derriere une socket morte, c'est promettre un canal
         qui n'existe plus. */
      if (byUs) return;
      S.net = null;
      if (S.open) connectFailed('the connection to the game server dropped');
    },
  });

  try { await S.net.connect(); }
  catch (e) { connectFailed(e.message); }
}

/* Les refus que le serveur formule en anglais, dits dans la langue du joueur.
   Un message inconnu passe tel quel : mieux vaut une phrase anglaise qu'un
   silence, et sa presence signale la cle qui manque. */
const REFUS = {
  'not enough coins': 'err.coins',
  'betting is closed': 'err.betClosed',
  'your bet is already placed': 'err.betDone',
  'enter a whole number of coins': 'err.betWhole',
  'not your turn': 'game.waitTurn',
  'you already rolled': 'game.alreadyRolled',
  'the match has not started': 'err.notStarted',
  'you are not in a match': 'err.noMatch',
  'you are already in a match': 'err.inMatch',
  'you cannot change captain during a match': 'err.captainLocked',
};

function messageServeur(brut) {
  if (!brut) return t('err.refused');
  const cle = REFUS[brut];
  return cle ? t(cle) : brut;
}

/* Rouvrir ce qu'un envoi avait ferme par avance. Aujourd'hui la mise ; tout
   bouton qui se desactive en attendant une reponse a sa place ici. */
function rendreLaMain() {
  const go = $('#dc-bet-go');
  if (go) go.disabled = false;
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
  if (retry) retry.onclick = () => { arreterRelance(); connect(); };

  /* ⚠️ CE N'EST PAS AU JOUEUR DE REESSAYER. Un ascenseur, un tunnel, un
     changement de wifi : la connexion revient d'elle-meme quelques secondes plus
     tard, et l'ecran restait plante sur son message jusqu'a ce qu'on pense a
     taper. Le serveur garde d'ailleurs la table dressee pendant ce temps — il
     serait absurde de laisser expirer ce delai faute d'un geste.

     L'attente double a chaque echec (1, 2, 4… jusqu'a 15 s) : marteler un serveur
     qui redemarre le ralentit et vide la batterie pour rien. */
  relancerPlusTard();
}

const RELANCE_MIN = 1000;
const RELANCE_MAX = 15000;
let relanceDelai = RELANCE_MIN;
let relanceTimer = 0;

function arreterRelance() {
  if (relanceTimer) { clearTimeout(relanceTimer); relanceTimer = 0; }
  relanceDelai = RELANCE_MIN;
}

function relancerPlusTard() {
  if (relanceTimer) return;                     // une seule tentative en vol
  const dans = relanceDelai;
  relanceDelai = Math.min(RELANCE_MAX, relanceDelai * 2);
  relanceTimer = setTimeout(() => {
    relanceTimer = 0;
    if (!S.open) return;                        // le joueur est parti : on se tait
    connect();
  }, dans);
}

/**
 * Quitter — et « quitter » ne veut pas dire la meme chose des deux cotes.
 *
 * ⚠️ DANS LE TOOL le jeu est une surcouche : la fermer rend la main au
 * back-office, ce qui est le geste attendu. DANS L'APPLICATION, cette meme
 * surcouche EST l'application : la fermer laissait un ecran de jeu fige, sans
 * menu, sans retour possible — et `closeDice()` ferme aussi la socket, si bien
 * que le moindre onglet touche ensuite plantait sur `S.net` a null (« cannot
 * read properties of null »). Un seul geste, deux defauts.
 *
 * On distingue donc les deux mondes par `UI.standalone`, pose par le demarrage
 * de l'application. Autonome : on abandonne la partie et on revient au pont.
 * Surcouche : on referme, comme avant.
 */
function requestClose() {
  const live = S.state && S.state.phase !== 'over';
  const sortir = () => {
    if (UI.standalone) { UI.leaveMatch ? UI.leaveMatch() : showMenu(); return; }
    closeDice();
  };
  if (!live) { sortir(); return undefined; }
  uiConfirm(t('game.leaveConfirm'), t('game.leaveTitle'), t('game.leaveOk'))
    .then((yes) => { if (yes) { if (S.net) S.net.send({ t: 'leave' }); sortir(); } });
  return undefined;
}

function closeDice() {
  const wrap = $('#dicewrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  wrap.setAttribute('aria-hidden', 'true');
  S.open = false;
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
    <img class="dc-avatar" src="${captainArt(S.me.captain)}" alt="">
    <div class="dc-wallet-txt">
      <b>${esc(S.me.name)}</b>
      <span>${esc(t('hdr.record', { rating: S.me.rating, wins: S.me.wins, losses: S.me.losses, draws: S.me.draws }))}</span>
    </div>
    <div class="dc-coins" title="${esc(t('hdr.coins'))}">${S.me.coins}
      <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>`;
}

/* Le pont vit dans dice_lobby.js : choix du capitaine et salon prive y sont
   deux ecrans a part entiere, et ce fichier n'a pas a les porter. */
function showMenu() {
  renderMenu($('#dc-screen-menu'));
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
  UI.leaveMatch = () => { S.state = null; S.seat = -1; showMenu(); };
  UI.renderWallet = renderWallet;
  UI.requestClose = requestClose;
}
