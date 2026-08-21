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
/**
 * La barre d'etat ne doit pas recouvrir l'entete.
 *
 * ⚠️ Trouve sur un Android 16 REEL, pas dans la documentation : depuis que
 * l'application vise l'API 36, le systeme impose le bord a bord et dessine son
 * heure et son signal PAR-DESSUS la page. `env(safe-area-inset-top)` etait deja
 * en place et valait zero — sur Android, la WebView ne recoit pas ces valeurs
 * d'elle-meme.
 */
async function reglerBarreEtat() {
  const cap = window.Capacitor;
  const bar = cap && cap.Plugins && cap.Plugins.StatusBar;
  if (!bar) return;
  try {
    await bar.setOverlaysWebView({ overlay: false });
    await bar.setBackgroundColor({ color: '#241C33' });
    await bar.setStyle({ style: 'DARK' });        // DARK = fond sombre, texte clair
  } catch (e) {
    /* Un navigateur de bureau n'a pas de barre d'etat : ce n'est pas une panne. */
  }
}

function host() {
  return document.getElementById('dicewrap') || document.body;
}

/* L'animation du splash dure 2,47 s. Sur une bonne connexion l'application est
   prete en moins d'une seconde : sans ce plancher, le crane disparaissait avant
   d'avoir fini de se former, ce qui donne l'impression d'un bug plutot que d'une
   marque. On ne fait attendre personne au-dela — si l'ouverture prend plus
   longtemps, le splash s'en va des qu'elle est finie. */
const SPLASH_MS = 2500;
const splashDepuis = Date.now();

function splashOff() {
  const splash = document.getElementById('pd-splash');
  if (!splash) return;
  const reste = Math.max(0, SPLASH_MS - (Date.now() - splashDepuis));
  setTimeout(() => {
    splash.classList.add('gone');
    setTimeout(() => splash.remove(), 420);
  }, reste);
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
      /* ⚠️ RETOUR sur une partie TERMINEE laissait le joueur devant un plateau
         mort, sans aucune sortie : la carte de resultat s'etait fermee et rien
         ne la ramenait. Le retour renvoie donc au pont. */
      const back = document.getElementById('dc-back');
      if (back) { back.click(); return; }
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

      ${motionAvailable() ? row(t('set.motion'), `<button class="pd-toggle${
        motionEnabled() ? ' on' : ''}" data-motion>${t(motionEnabled() ? 'set.soundOn' : 'set.soundOff')}</button>`)
        + `<p class="pd-hint">${t('set.motionHelp')}</p>` : ''}

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

  const motion = wrap.querySelector('[data-motion]');
  if (motion) {
    motion.onclick = () => {
      const now = setMotionEnabled(!motionEnabled());
      motion.classList.toggle('on', now);
      motion.textContent = t(now ? 'set.soundOn' : 'set.soundOff');
      toast(t(now ? 'motion.on' : 'motion.off'), now ? 'ok' : undefined);
    };
  }

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

  const gear = document.createElement('button');
  gear.className = 'dc-icon';
  gear.id = 'pd-settings-btn';
  gear.title = t('set.title');
  gear.innerHTML = '<img src="dice/img/icon_settings.png" alt="">';
  gear.onclick = openSettings;
  acts.appendChild(gear);
}

/* ── les feuilles : une barre de fermeture visible ────────────────────────
   Une feuille qui monte du bas doit dire comment elle se ferme. Sans repere,
   il fallait deviner qu'un second appui sur l'onglet la refermait — ou
   connaitre le bouton RETOUR d'Android. */

function addSheetBar() {
  const panel = document.getElementById('dc-panel');
  if (!panel || panel.querySelector('.pd-sheet-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'pd-sheet-bar';
  bar.innerHTML = '<span class="pd-sheet-spacer"></span><span class="pd-grab"></span>'
    + '<button class="pd-sheet-close" aria-label="' + t('set.close') + '">&times;</button>';
  bar.querySelector('.pd-sheet-close').onclick = () => {
    const tab = document.querySelector('#dicewrap .dc-tab.on');
    if (tab) tab.click();
  };
  panel.insertBefore(bar, panel.firstChild);
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
  await reglerBarreEtat();
  splashOff();
  /* La connexion se fait SEULE : c'est la promesse de la fiche. Si Google n'est
     pas joignable (appareil sans services Play, ou refus), on retombe sur le
     compte invite de ce telephone plutot que de bloquer le joueur devant un mur. */
  await signIn({ interactive: false });
  await openDice();
  addHeaderButtons();
  addSheetBar();
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
