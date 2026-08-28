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

/**
 * La liste a dessiner : celle du serveur si elle est arrivee, sinon la notre.
 *
 * ⚠️ L'ORDRE EST CELUI DU DEVERROUILLAGE. Les cinq medaillons se lisent de
 * gauche a droite comme une progression : le premier est a tout le monde, le
 * dernier se merite. Un ordre au hasard aurait fait de la rangee une grille de
 * choix ; celui-ci en fait un chemin.
 */
function listeCapitaines() {
  const venue = S.captains;
  if (Array.isArray(venue) && venue.length) return venue.filter((c) => known(c.id));
  return CAPTAIN_IDS.map((id) => ({ id, seuil: 0 }));
}

/** Combien de parties terminees le joueur a-t-il ? */
function parties() {
  return (S.me && Number(S.me.games)) || 0;
}

function seuilDe(id) {
  const c = listeCapitaines().find((x) => x.id === id);
  return c ? (Number(c.seuil) || 0) : 0;
}

/** Ce capitaine est-il gagne ? Le serveur retranchera de toute facon. */
export function capitaineOuvert(id) {
  return parties() >= seuilDe(id);
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

/* ⚠️ LE CADENAS EST DESSINE ICI, PAS CHARGE. Le depot n'a pas d'icone de
   cadenas, et en inventer une au rabais — un emoji, un carre gris — aurait jure
   avec des medaillons peints a la main. Deux traits de SVG donnent une forme
   nette a toutes les tailles, aux couleurs du jeu, et sans un octet de plus.
   Le jour ou l'icone dessinee arrive, cette constante devient une balise img. */
const CADENAS = `<svg class="dc-verrou-svg" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" fill="none" stroke="currentColor"
        stroke-width="2.6" stroke-linecap="round"/>
  <rect x="4.5" y="10" width="15" height="11" rx="2.6" fill="currentColor"/>
  <circle cx="12" cy="15" r="1.7" fill="rgba(35,20,60,.85)"/>
</svg>`;

/* ────────────────────────────────────────────────── le choix du capitaine ── */

function captainStrip() {
  const chosen = mine();
  const jouees = parties();
  return `
    <div class="dc-caps">
      <h4 class="dc-caps-head">${esc(t('cap.choose'))}</h4>
      <div class="dc-caps-row">${listeCapitaines().map((c) => {
        const id = c.id;
        const seuil = Number(c.seuil) || 0;
        const ferme = jouees < seuil;
        /* ⚠️ LE CADENAS DIT COMBIEN IL RESTE, PAS SEULEMENT « FERME ». Un
           medaillon grise sans chiffre est une porte sans serrure : on ne sait
           ni pourquoi elle resiste, ni si elle s'ouvrira un jour. Le compte
           restant transforme le refus en objectif. */
        const reste = Math.max(0, seuil - jouees);
        return `
        <button class="dc-cap${id === chosen ? ' on' : ''}${ferme ? ' dc-cap-ferme' : ''}"
                data-cap="${id}" data-ferme="${ferme ? 1 : 0}"
                title="${esc(ferme ? t('cap.locked', { n: reste }) : captainName(id))}"
                aria-pressed="${id === chosen}">
          <img class="dc-cap-face" src="${captainArt(id)}" alt="${esc(captainName(id))}">
          ${ferme ? `<span class="dc-cap-verrou">${CADENAS}<b>${jouees}/${seuil}</b></span>` : ''}
        </button>`;
      }).join('')}
      </div>
      <div class="dc-cap-card" id="dc-cap-card">${captainCard(chosen)}</div>
    </div>`;
}

function captainCard(id) {
  const seuil = seuilDe(id);
  const ferme = !capitaineOuvert(id);
  return `
    <img class="dc-cap-trait${ferme ? ' dc-cap-trait-ferme' : ''}" src="${traitArt(id)}" alt="">
    <div class="dc-cap-txt">
      <b>${esc(captainName(id))}</b>
      <span>${esc(ferme ? t('cap.lockedLong', { n: seuil }) : captainTrait(id))}</span>
    </div>`;
}

/**
 * Repeindre le seul bandeau des capitaines, sans refaire le pont.
 *
 * ⚠️ REFAIRE TOUT LE MENU AURAIT COUTE PLUS QUE CA NE RAPPORTE. `renderMenu`
 * remet aussi le salon prive a zero : un joueur en train de saisir un code
 * l'aurait vu disparaitre parce qu'un capitaine a ete refuse a l'autre bout.
 * On ne redessine que ce qui a menti.
 */
export function repeindreCapitaines() {
  const bloc = document.querySelector('#dicewrap .dc-caps');
  if (!bloc) return;
  const hote = bloc.parentElement;
  bloc.outerHTML = captainStrip();
  wireCaptains(hote);
}

function wireCaptains(el) {
  el.querySelectorAll('[data-cap]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.cap;
      if (id === mine()) return;
      /* ⚠️ UN CAPITAINE FERME SE PRESENTE QUAND MEME. Le clic ne le choisit
         pas, mais il montre sa carte : voir le trait qu'on n'a pas encore est
         ce qui donne envie de le gagner. Un bouton totalement mort
         n'apprendrait rien a personne. */
      if (b.dataset.ferme === '1') {
        const card = $('#dc-cap-card');
        if (card) card.innerHTML = captainCard(id);
        if (S.sfx) S.sfx.play('shut', 0.2);
        toast(t('cap.locked', { n: Math.max(0, seuilDe(id) - parties()) }), 'warn');
        return;
      }
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

/* ── L'ATTENTE D'UN ADVERSAIRE A UNE FIN ──────────────────────────────────
   Deux minutes : au-dela, il ne se passe rien parce qu'il n'y a personne, pas
   parce que le jeu cherche encore. On arrete la roue et on le DIT — avec de
   quoi relancer, parce qu'un joueur peut arriver a la minute suivante. */
const ATTENTE_MAX_MS = 120000;
let attenteDebut = 0;
let attenteTimer = 0;

function lancerAttente(redessiner) {
  if (!attenteDebut) attenteDebut = Date.now();
  if (attenteTimer || !redessiner) return;
  const reste = Math.max(500, ATTENTE_MAX_MS - (Date.now() - attenteDebut));
  attenteTimer = setTimeout(() => { attenteTimer = 0; redessiner(); }, reste);
}

function arreterAttente() {
  if (attenteTimer) { clearTimeout(attenteTimer); attenteTimer = 0; }
  attenteDebut = 0;
}

function attenteDepassee() {
  return !!attenteDebut && (Date.now() - attenteDebut) >= ATTENTE_MAX_MS;
}

/** La recherche repart de zero : appelee quand on entre dans une partie. */
export function oublierAttente() { arreterAttente(); }

/* ──────────────────────────────────────────────────────── le menu du pont ── */

export function renderMenu(el) {
  screen('menu');

  if (S.queued) {
    /* ⛔ LA ROUE TOURNAIT SANS FIN. « Il n'y a personne en ligne » n'est pas une
       panne, mais une roue qui tourne pendant dix minutes ressemble a une panne
       — et le joueur n'a aucun moyen de savoir laquelle des deux il regarde. Au
       bout de deux minutes, on le dit et on lui rend la main. */
    const trop = attenteDepassee();
    el.innerHTML = `
      <div class="dc-menu"><div class="dc-menu-card pd-panel">
        ${trop ? '' : `<img class="dc-wheel" src="${ASSETS}img/icon_loader.png" alt="">`}
        <h3>${esc(t(trop ? 'menu.noOne' : 'menu.waiting'))}</h3>
        <p>${esc(t(trop ? 'menu.noOneHint' : 'menu.waitingHint'))}</p>
        ${trop ? `<button class="dc-btn" id="dc-requeue">${esc(t('menu.retry'))}</button>` : ''}
        <button class="dc-btn dc-btn-ghost" id="dc-unqueue">${esc(t('menu.cancel'))}</button>
      </div></div>`;
    $('#dc-unqueue').onclick = () => { arreterAttente(); S.net.send({ t: 'cancel' }); };
    const relancer = $('#dc-requeue');
    if (relancer) {
      relancer.onclick = () => {
        /* On repart d'une file propre : le serveur nous y a peut-etre garde. */
        if (S.net) S.net.send({ t: 'cancel' });
        lancerAttente();
        if (S.net) S.net.send({ t: 'play', mode: 'multi' });
        renderMenu(el);
      };
    }
    if (!trop) lancerAttente(() => renderMenu(el));
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
        <!-- ⛔ « ELO » EST UN MOT D'INITIE, ET IL NE DIT RIEN AU JOUEUR. C'est le
             nom d'un algorithme de 1960, pas celui d'une recompense : personne
             n'a besoin de savoir comment son classement est calcule pour vouloir
             le faire monter. L'insigne le remplace — il se lit sans traduction,
             dans les quatre langues, et il ressemble a ce qu'il represente. -->
        <span><b>${S.me ? S.me.rating : 0}</b> <img class="dc-insigne"
              src="${ASSETS}img/icon_elo.png" alt="${esc(t('menu.rang'))}"
              title="${esc(t('menu.rang'))}"></span>
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
  /* Une partie commence : le compte a rebours de l'attente n'a plus d'objet. */
  arreterAttente();
  lobby = null;
  hostCode = '';
}
