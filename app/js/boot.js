/* ============================================================================
   boot.js — le demarrage de l'application.

   Le jeu (js/pages/dice*.js) est le MEME code que dans Reforged Studio. Ce
   fichier ne fait que ce qu'un telephone exige en plus : ouvrir une session sur
   le compte Google, poser la table en plein ecran, rendre le bouton RETOUR
   inoffensif, et offrir les quatre reglages du telephone.
   ============================================================================ */

import { initDice, openDice } from './pages/dice.js';
import { S, myTurn } from './pages/dice_state.js';
import { signIn, signOut, account, eraseAccount } from './identity.js';
import { startFitting } from './fit.js';
import { t, LANGS, lang, setLang } from './core/i18n.js';
import { startMotion, motionEnabled, setMotionEnabled, motionAvailable } from './motion.js';
import { toast } from './ui/toast.js';
import { uiConfirm } from './ui/dialogs.js';

const TERMS_URL = 'https://usernabil.github.io/piratesdice/privacy.html';

/* ⚠️ Les boites vivent DANS #dicewrap. La menuiserie (.pd-panel, .dc-btn) est
   ecrite sous `#dicewrap ...` : posee sur <body>, une carte de reglages
   n'heritait de RIEN — fond transparent, boutons gris. Vu a l'ecran. */
function host() {
  return document.getElementById('dicewrap') || document.body;
}

function splashOff() {
  const splash = document.getElementById('pd-splash');
  if (!splash) return;
  splash.classList.add('gone');
  setTimeout(() => splash.remove(), 420);
}

/* ── le bouton RETOUR d'Android ──────────────────────────────────────────── */

function wireBackButton() {
  const fire = () => {
    const ev = new CustomEvent('pd-back', { cancelable: true });
    document.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const cap = window.Capacitor;
  if (cap && cap.Plugins && cap.Plugins.App) {
    cap.Plugins.App.addListener('backButton', () => {
      if (fire()) return;
      const tab = document.querySelector('#dicewrap .dc-tab.on');
      if (tab) { tab.click(); return; }
      const close = document.getElementById('dc-close');
      if (close) close.click();
    });
    return;
  }
  window.addEventListener('popstate', () => { fire(); history.pushState(null, ''); });
  history.pushState(null, '');
}

/* ── les reglages : son, compte, langue, conditions. Rien d'autre. ───────── */

function row(label, body) {
  return `<div class="pd-row"><span class="pd-row-lbl">${label}</span>${body}</div>`;
}

function settingsMarkup() {
  const acc = account();
  const who = acc.google ? t('set.signedInAs', { name: acc.name }) : t('set.guest');
  const button = acc.google
    ? `<button class="dc-btn dc-btn-sm dc-btn-ghost" data-signout>${t('set.signOut')}</button>`
    : `<button class="dc-btn dc-btn-sm" data-signin>${t('set.signIn')}</button>`;
  const muted = !!(S.sfx && S.sfx.muted);

  return `
    <div class="pd-ask-card pd-panel pd-set">
      <h3>${t('set.title')}</h3>

      ${row(t('set.sound'), `<button class="pd-toggle${muted ? '' : ' on'}" data-sound
              aria-pressed="${!muted}">${t(muted ? 'set.soundOff' : 'set.soundOn')}</button>`)}

      ${row(t('set.account'), `<span class="pd-row-val">${who}</span>`)}
      <div class="pd-row pd-row-btns">${button}
        <button class="dc-btn dc-btn-sm dc-btn-ghost pd-danger" data-erase>${t('set.erase')}</button>
      </div>

      ${row(t('set.language'), `<select class="pd-select" data-lang>${
        LANGS.map((l) => `<option value="${l.code}"${l.code === lang() ? ' selected' : ''}>${l.label}</option>`).join('')
      }</select>`)}

      ${row(t('set.terms'), `<a class="pd-link" href="${TERMS_URL}" target="_blank" rel="noopener">&#8599;</a>`)}

      <div class="pd-ask-row"><button class="dc-btn" data-close>${t('set.close')}</button></div>
    </div>`;
}

function openSettings() {
  const wrap = document.createElement('div');
  wrap.className = 'pd-ask on';
  wrap.innerHTML = settingsMarkup();
  host().appendChild(wrap);

  const close = () => wrap.remove();
  const back = (ev) => { ev.preventDefault(); close(); };
  document.addEventListener('pd-back', back, { once: true });
  wrap.onclick = (ev) => { if (ev.target === wrap) close(); };
  wrap.querySelector('[data-close]').onclick = close;

  const sound = wrap.querySelector('[data-sound]');
  sound.onclick = () => {
    const mute = document.getElementById('dc-mute');
    if (mute) mute.click();
    const off = !!(S.sfx && S.sfx.muted);
    sound.textContent = t(off ? 'set.soundOff' : 'set.soundOn');
    sound.classList.toggle('on', !off);
    sound.setAttribute('aria-pressed', String(!off));
  };

  wrap.querySelector('[data-lang]').onchange = (ev) => {
    setLang(ev.target.value);
    location.reload();                       // le jeu se redessine dans la langue choisie
  };

  const inBtn = wrap.querySelector('[data-signin]');
  if (inBtn) {
    inBtn.onclick = async () => {
      inBtn.disabled = true;
      try { await signIn({ interactive: true }); location.reload(); }
      catch (e) { toast(e.message, 'warn'); inBtn.disabled = false; }
    };
  }
  const outBtn = wrap.querySelector('[data-signout]');
  if (outBtn) outBtn.onclick = async () => { await signOut(); location.reload(); };

  wrap.querySelector('[data-erase]').onclick = async () => {
    close();
    if (!await uiConfirm(t('set.eraseAsk'), t('set.erase'), t('set.eraseOk'))) return;
    await eraseAccount();
    toast(t('set.erased'), 'ok');
    setTimeout(() => location.reload(), 900);
  };
}

/* ── les deux boutons ajoutes a l'entete du jeu ──────────────────────────── */

function addHeaderButtons() {
  const acts = document.querySelector('#dicewrap .dc-acts');
  if (!acts || document.getElementById('pd-settings-btn')) return;

  /* Le mouvement se coupe d'un geste, depuis l'entete : c'est une commande de
     JEU, pas un reglage de telephone — et on veut pouvoir la couper en pleine
     partie sans ouvrir un ecran par-dessus la table. */
  if (motionAvailable()) {
    const tilt = document.createElement('button');
    tilt.className = 'dc-icon pd-tilt' + (motionEnabled() ? ' on' : '');
    tilt.id = 'pd-motion-btn';
    tilt.title = t('set.motion');
    tilt.innerHTML = '<span class="pd-glyph">&#8635;</span>';
    tilt.onclick = () => {
      const now = setMotionEnabled(!motionEnabled());
      tilt.classList.toggle('on', now);
      toast(t(now ? 'motion.on' : 'motion.off'), now ? 'ok' : undefined);
    };
    acts.appendChild(tilt);
  }

  const gear = document.createElement('button');
  gear.className = 'dc-icon';
  gear.id = 'pd-settings-btn';
  gear.title = t('set.title');
  gear.innerHTML = '<span class="pd-glyph">&#9881;</span>';
  gear.onclick = openSettings;
  acts.appendChild(gear);
}

/* ── les mouvements : le module ne connait pas le jeu, on lui explique ───── */

function wireMotion() {
  const board = () => document.querySelector('#dc-slot-me .dc-board');

  startMotion({
    canRoll: () => !!(myTurn() && S.state && S.state.dice[S.seat] === null),
    canPlace: () => !!(myTurn() && S.state && S.state.dice[S.seat] !== null
      && !(S.state.pending && S.state.pending.seat === S.seat)),
    roll: () => { if (S.net) S.net.send({ t: 'roll' }); },
    place: (column) => { if (S.net) S.net.send({ t: 'place', column }); },
    aim: (column) => {
      const b = board();
      if (!b) return;
      b.querySelectorAll('.dc-col').forEach((col, i) => {
        col.classList.toggle('pd-aim', i === column);
      });
    },
  });
}

/* ── demarrage ──────────────────────────────────────────────────────────── */

async function start() {
  initDice();
  wireBackButton();
  splashOff();
  /* La connexion se fait SEULE : c'est la promesse de la fiche. Si Google n'est
     pas joignable (appareil sans services Play, ou refus), on retombe sur le
     compte invite de ce telephone plutot que de bloquer le joueur devant un mur. */
  await signIn({ interactive: false });
  await openDice();
  addHeaderButtons();
  startFitting();
  wireMotion();
}

start().catch((e) => {
  splashOff();
  const box = document.createElement('div');
  box.className = 'pd-first on';
  box.innerHTML = `<div class="pd-first-card pd-panel"><h1>${t('connect.outOfReach')}</h1>
    <p>${(e && e.message) || ''}</p>
    <button class="dc-btn" onclick="location.reload()">${t('connect.retry')}</button></div>`;
  document.body.appendChild(box);
});
