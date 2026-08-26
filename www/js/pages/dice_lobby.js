/* ============================================================================
   pages/dice_lobby.js — le pont : ce qu'on fait AVANT de s'asseoir.

   Le choix du capitaine et le rendez-vous entre amis sont deux moments d'avant
   la partie ; ils vivent donc ensemble, et hors de dice.js — qui frolait deja
   la limite de 400 lignes et n'a pas a grossir d'un ecran de plus.

   ⛔ AUCUNE REGLE ICI. Le trait d'un capitaine est applique par le serveur, et
   par lui seul : cet ecran ne fait que le montrer et l'envoyer. Un client qui
   deciderait d'un effet serait un client qu'on peut modifier pour tricher.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/toast.js';
import { S, ASSETS, screen } from './dice_state.js';

const CAPTAIN_IDS = ['read', 'teach', 'ching', 'omalley', 'jack'];
const DEFAULT_CAPTAIN = 'read';

/* L'ecran du salon est un etat LOCAL : le serveur ne connait qu'un code et deux
   sessions, il n'a pas a savoir quel panneau on regarde. */
let lobby = null;          // null | 'menu' | 'host' | 'guest'
let hostCode = '';

function known(id) {
  return CAPTAIN_IDS.includes(id);
}

function captainOf(id) {
  return known(id) ? id : DEFAULT_CAPTAIN;
}

export function captainArt(id) {
  return ASSETS + 'img/cap_' + captainOf(id) + '.png';
}

export function traitArt(id) {
  return ASSETS + 'img/trait_' + captainOf(id) + '.png';
}

export function captainName(id) {
  return t('cap.' + captainOf(id) + '.name');
}

export function captainTrait(id) {
  return t('cap.' + captainOf(id) + '.trait');
}

function mine() {
  return captainOf(S.me && S.me.captain);
}

/* ────────────────────────────────────────────────── le choix du capitaine ── */

function captainStrip() {
  const chosen = mine();
  return `
    <div class="dc-caps">
      <h4 class="dc-caps-head">${esc(t('cap.choose'))}</h4>
      <div class="dc-caps-row">${CAPTAIN_IDS.map((id) => `
        <button class="dc-cap${id === chosen ? ' on' : ''}" data-cap="${id}"
                title="${esc(captainName(id))}" aria-pressed="${id === chosen}">
          <img class="dc-cap-face" src="${captainArt(id)}" alt="${esc(captainName(id))}">
        </button>`).join('')}
      </div>
      <div class="dc-cap-card" id="dc-cap-card">${captainCard(chosen)}</div>
    </div>`;
}

function captainCard(id) {
  return `
    <img class="dc-cap-trait" src="${traitArt(id)}" alt="">
    <div class="dc-cap-txt">
      <b>${esc(captainName(id))}</b>
      <span>${esc(captainTrait(id))}</span>
    </div>`;
}

function wireCaptains(el) {
  el.querySelectorAll('[data-cap]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.cap;
      if (id === mine()) return;
      /* On peint tout de suite et on envoie : attendre la reponse du serveur
         pour allumer le medaillon donnerait un ecran qui hesite. La reponse
         `me` repassera par la et confirmera. */
      if (S.me) S.me.captain = id;
      el.querySelectorAll('[data-cap]').forEach((o) => {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-pressed', String(o === b));
      });
      const card = $('#dc-cap-card');
      if (card) card.innerHTML = captainCard(id);
      if (S.sfx) S.sfx.play('open', 0.16);
      if (S.net) S.net.send({ t: 'captain', captain: id });
    };
  });
}

/* ──────────────────────────────────────────────────────── le menu du pont ── */

export function renderMenu(el) {
  screen('menu');

  if (S.queued) {
    el.innerHTML = `
      <div class="dc-menu"><div class="dc-menu-card pd-panel">
        <img class="dc-wheel" src="${ASSETS}img/icon_loader.png" alt="">
        <h3>${esc(t('menu.waiting'))}</h3>
        <p>${esc(t('menu.waitingHint'))}</p>
        <button class="dc-btn dc-btn-ghost" id="dc-unqueue">${esc(t('menu.cancel'))}</button>
      </div></div>`;
    $('#dc-unqueue').onclick = () => S.net.send({ t: 'cancel' });
    return;
  }

  if (lobby === 'host' || lobby === 'guest') { renderRoom(el); return; }

  el.innerHTML = `
    <div class="dc-menu"><div class="dc-menu-card pd-panel">
      <h2>${esc(t('menu.title'))}</h2>
      <p>${esc(t('menu.pitch'))}</p>
      ${captainStrip()}
      <!-- LES DESSINS SORTENT DU CADRE, ET ILS ALTERNENT.
           Enfermes dans le bouton, ils valaient 1,9 fois la hauteur du texte —
           trois vignettes en file indienne, illisibles, et le bouton n'etait
           qu'une barre de plus. Poses A CHEVAL sur le bord, ils reprennent la
           taille d'une illustration et donnent au menu son relief.
           L'alternance gauche / droite / gauche est ce que l'admin a demande :
           l'oeil zigzague au lieu de descendre une colonne, et les trois modes
           cessent de se ressembler. -->
      <div class="dc-menu-btns">
        <button class="dc-btn dc-btn-big dc-btn-art dc-btn-deborde dc-btn-deborde-g" id="dc-solo">
          <img src="${ASSETS}img/menu_ai.png" alt="">${esc(t('menu.solo'))}</button>
        <button class="dc-btn dc-btn-big dc-btn-alt dc-btn-art dc-btn-deborde dc-btn-deborde-d" id="dc-multi">
          <img src="${ASSETS}img/menu_versus.png" alt="">${esc(t('menu.multi'))}</button>
        <button class="dc-btn dc-btn-ghost dc-btn-art dc-btn-deborde dc-btn-deborde-g" id="dc-friend">
          <img src="${ASSETS}img/menu_friend.png" alt="">${esc(t('menu.friend'))}</button>
      </div>
      <div class="dc-menu-stats">
        <span><b>${S.me ? S.me.games : 0}</b> ${esc(t('menu.matches'))}</span>
        <span><b>${S.me ? S.me.rating : 0}</b> ${esc(t('menu.elo'))}</span>
        <span><b>${S.me ? S.me.coins : 0}</b> ${esc(t('menu.coins'))}</span>
      </div>
    </div></div>`;

  wireCaptains(el);
  $('#dc-solo').onclick = () => { S.sfx.play('start', 0.25); S.net.send({ t: 'play', mode: 'solo' }); };
  $('#dc-multi').onclick = () => S.net.send({ t: 'play', mode: 'multi' });
  $('#dc-friend').onclick = () => { lobby = 'guest'; renderMenu(el); };
}

/* ─────────────────────────────────────────────────────── le salon prive ──── */

function renderRoom(el) {
  const attente = lobby === 'host';
  el.innerHTML = `
    <div class="dc-menu"><div class="dc-menu-card pd-panel dc-room">
      <h3>${esc(t(attente ? 'room.waiting' : 'room.title'))}</h3>
      ${attente ? `
        <p>${esc(t('room.share'))}</p>
        <div class="dc-room-code" id="dc-room-code">${esc(hostCode)}</div>
        <img class="dc-wheel" src="${ASSETS}img/icon_loader.png" alt="">
        <p class="dc-dim">${esc(t('room.expires'))}</p>
      ` : `
        <p>${esc(t('room.hint'))}</p>
        <div class="dc-room-join">
          <input id="dc-room-input" class="dc-room-input" maxlength="5" autocomplete="off"
                 spellcheck="false" inputmode="text" placeholder="${esc(t('room.placeholder'))}"
                 aria-label="${esc(t('room.placeholder'))}">
          <button class="dc-btn dc-btn-art" id="dc-room-go">
            <img src="${ASSETS}img/icon_join.png" alt="">${esc(t('room.join'))}</button>
        </div>
        <p class="dc-room-or">${esc(t('room.or'))}</p>
        <button class="dc-btn dc-btn-alt dc-btn-art" id="dc-room-create">
          <img src="${ASSETS}img/icon_table.png" alt="">${esc(t('room.create'))}</button>
      `}
      <button class="dc-btn dc-btn-ghost dc-btn-art" id="dc-room-back">
        <img src="${ASSETS}img/icon_back.png" alt="">${esc(t('menu.cancel'))}</button>
    </div></div>`;

  const back = $('#dc-room-back');
  back.onclick = () => {
    if (attente && S.net) S.net.send({ t: 'room', action: 'cancel' });
    lobby = null; hostCode = '';
    renderMenu(el);
  };
  if (attente) {
    const code = $('#dc-room-code');
    code.onclick = () => copyCode(hostCode);
    return;
  }

  const input = $('#dc-room-input');
  const go = () => {
    const code = (input.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { toast(t('room.badCode'), 'warn'); return; }
    S.net.send({ t: 'room', action: 'join', code });
  };
  /* Le code se dicte en majuscules : on ne demande pas au joueur d'y penser. */
  input.oninput = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  input.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } };
  $('#dc-room-go').onclick = go;
  $('#dc-room-create').onclick = () => S.net.send({ t: 'room', action: 'create' });
  setTimeout(() => { try { input.focus(); } catch (_) { /* pas de clavier */ } }, 60);
}

function copyCode(code) {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(code)
    .then(() => toast(t('room.copied'), 'ok'))
    .catch(() => { /* presse-papier refuse : le code reste lisible a l'ecran */ });
}

/** Le serveur a ouvert le salon : on montre le code. */
export function onRoom(msg, el) {
  lobby = 'host';
  hostCode = msg.code || '';
  renderMenu(el);
}

export function onRoomFail(msg) {
  const raison = { 'no such room': 'room.unknown', 'the host has left': 'room.gone',
                   'this is your own room': 'room.own', 'bad code': 'room.badCode' };
  toast(t(raison[msg.msg] || 'room.unknown'), 'warn');
}

/** Le pont redevient le pont : appele quand une partie demarre ou qu'on revient. */
export function resetLobby() {
  lobby = null;
  hostCode = '';
}
