/* ============================================================================
   boot.js — le demarrage de l'application.

   Le jeu (js/pages/dice*.js) est le MEME code que dans Reforged Studio. Ce
   fichier ne fait que ce qu'un telephone exige en plus : ouvrir une session sur
   le compte Google, poser la table en plein ecran, rendre le bouton RETOUR
   inoffensif, et offrir les quatre reglages du telephone.
   ============================================================================ */

import { initDice, openDice } from './pages/dice.js';
import { S, UI, myTurn } from './pages/dice_state.js';
import { signIn, signOut, account, eraseAccount, fournisseur } from './identity.js';
import { startFitting } from './fit.js';
import { t, LANGS, lang, setLang } from './core/i18n.js';
import { startMotion } from './motion.js';
import { toast } from './ui/toast.js';
import { uiConfirm } from './ui/dialogs.js';

const TERMS_URL = 'https://usernabil.github.io/piratesdice-site/privacy.html';

/* ⚠️ Les boites vivent DANS #dicewrap. La menuiserie (.pd-panel, .dc-btn) est
   ecrite sous `#dicewrap ...` : posee sur <body>, une carte de reglages
   n'heritait de RIEN — fond transparent, boutons gris. Vu a l'ecran. */
/**
 * La page passe SOUS la barre d'etat, des deux cotes.
 *
 * ⚠️ Trouve sur un Android 16 REEL, pas dans la documentation : depuis que
 * l'application vise l'API 36, le systeme impose le bord a bord. La page etait
 * donc inseree SOUS la barre (`overlay: false`), ce qui reglait le recouvrement
 * mais laissait une bande violette morte de 90 px en haut — de la hauteur prise
 * aux plateaux, et une difference visible avec iOS, ou la page monte jusqu'au
 * bord. `env(safe-area-inset-top)` valait zero, mais la cause etait dans le
 * theme, pas dans la WebView : sans `windowLayoutInDisplayCutoutMode`, Android
 * ne transmet pas ces marges. Declaree (voir res/values/styles.xml), la page les
 * recoit et se protege elle-meme — meme mecanique que sur iOS.
 */
async function reglerBarreEtat() {
  const cap = window.Capacitor;
  const bar = cap && cap.Plugins && cap.Plugins.StatusBar;
  if (!bar) return;
  try {
    await bar.setOverlaysWebView({ overlay: true });
    await bar.setStyle({ style: 'DARK' });        // DARK = fond sombre, texte clair
  } catch (e) {
    /* Un navigateur de bureau n'a pas de barre d'etat : ce n'est pas une panne. */
  }
}

function host() {
  return document.getElementById('dicewrap') || document.body;
}

/**
 * L'ecran d'ouverture est celui du SYSTEME, et lui seul.
 *
 * Il y avait ici une animation jouee dans la page. Deux defauts : dessinee en
 * 160 pixels, elle etait agrandie quatre fois sur un ecran moderne ; et surtout
 * elle laissait voir l'application se remplir — la bourse apparaissait vide puis
 * se garnissait une seconde plus tard.
 *
 * Le splash natif, lui, couvre TOUT le demarrage : on le garde affiche
 * (`launchAutoHide: false`) et on ne le retire qu'une fois les donnees en main.
 * Hors application — dans un navigateur — il n'y en a pas, et il n'y a rien a
 * cacher : la fonction ne fait alors rien.
 */
async function splashOff() {
  const cap = window.Capacitor;
  const ecran = cap && cap.Plugins && cap.Plugins.SplashScreen;
  if (!ecran) return;
  try {
    await ecran.hide({ fadeOutDuration: 260 });
  } catch (e) {
    /* Pas de greffon : rien a cacher. */
  }
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
    /* Le libelle nomme le fournisseur de CETTE plateforme : « avec Google » sur
       un iPhone serait faux, et « avec Apple » sur Android n'existe pas. */
    : `<button class="dc-btn dc-btn-sm" data-signin>${
        t(fournisseur() === 'apple' ? 'set.signInApple' : 'set.signIn')}</button>`;
  const muted = !!(S.sfx && S.sfx.muted);

  return `
    <div class="pd-ask-card pd-panel pd-set">
      <h3>${t('set.title')}</h3>

      ${row(t('set.sound'), `<button class="pd-toggle${muted ? '' : ' on'}" data-sound
              aria-pressed="${!muted}">${t(muted ? 'set.soundOff' : 'set.soundOn')}</button>`)}

      <!-- Plus de reglage « jouer aux mouvements ». Secouer pour lancer est
           desormais toujours actif : un geste cache derriere un interrupteur
           n'est jamais decouvert, donc jamais utilise. -->

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
  /* Secouer lance le de, rien d'autre. La pose se fait au doigt : plus rapide,
     et elle ne rate jamais la colonne visee. */
  startMotion({
    canRoll: () => !!(myTurn() && S.state && S.state.dice[S.seat] === null),
    roll: () => { if (S.net) S.net.send({ t: 'roll' }); },
  });
}

/* ── demarrage ──────────────────────────────────────────────────────────── */

async function start() {
  /* ⚠️ CE DRAPEAU DECIDE DE CE QUE VEUT DIRE « QUITTER ». Dans le tool, le jeu
     est une surcouche qu'on referme pour revenir au back-office. Ici il EST
     l'application : la refermer laissait un ecran fige, sans menu et sans
     socket — et le moindre onglet touche ensuite plantait. Autonome, on revient
     au pont. */
  UI.standalone = true;
  initDice();
  wireBackButton();
  await reglerBarreEtat();
  /* La connexion se fait SEULE : c'est la promesse de la fiche. Si Google n'est
     pas joignable (appareil sans services Play, ou refus), on retombe sur le
     compte invite de ce telephone plutot que de bloquer le joueur devant un mur. */
  await signIn({ interactive: false });
  await openDice();
  addHeaderButtons();
  addSheetBar();
  startFitting();
  wireMotion();
  /* ⚠️ LE RIDEAU SE LEVE EN DERNIER, ET C'EST TOUT L'INTERET.
     Il partait juste apres la barre d'etat, donc AVANT la connexion et avant
     l'ouverture de la partie : on voyait la bourse vide se remplir une seconde
     plus tard, ce que l'admin a decrit comme « la zone monnaie toute rabougrie ».
     Une image de plus a l'ecran coute moins qu'une interface qui se monte sous
     les yeux du joueur. */
  await pretAAfficher();
  splashOff();
}

/**
 * Attend que la premiere image soit REELLEMENT peinte.
 *
 * `openDice()` rend la main quand les donnees sont en memoire, pas quand elles
 * sont a l'ecran : il reste une passe de mise en page et une passe de peinture.
 * Deux `requestAnimationFrame` imbriques placent la reprise apres la premiere
 * peinture — la seconde image existe donc deja quand le rideau se leve.
 * `document.fonts.ready` evite en prime le sursaut du texte quand « Luckiest
 * Guy » arrive apres coup.
 */
function pretAAfficher() {
  const polices = (document.fonts && document.fonts.ready) || Promise.resolve();
  const peint = polices.catch(() => {}).then(() => new Promise((ok) => {
    requestAnimationFrame(() => requestAnimationFrame(() => ok()));
  }));
  /* ⛔ UNE ATTENTE SANS PLAFOND EST UN ECRAN NOIR.
     Le rideau natif ne part plus tout seul : si `fonts.ready` ne se resout
     jamais — police absente, moteur en veille — l'application resterait bloquee
     sur l'ecran d'ouverture, sans message et sans recours. Trois secondes de
     plafond : passe ce delai on montre ce qu'on a, quitte a ce qu'une police
     arrive apres coup. Mieux vaut une interface imparfaite qu'aucune. */
  return Promise.race([peint, new Promise((ok) => setTimeout(ok, 3000))]);
}

/**
 * Le serveur ne repond pas : on le rappelle, tout seul.
 *
 * ⚠️ CE N'EST PAS AU JOUEUR DE REESSAYER. L'ecran affichait « serveur
 * injoignable » et un bouton : dans un ascenseur, un tunnel, un changement de
 * wifi, la connexion revient d'elle-meme trente secondes plus tard — et
 * l'application restait plantee sur son message jusqu'a ce qu'on pense a taper.
 * Une panne de reseau se resout en attendant, pas en cliquant.
 *
 * L'attente s'allonge a chaque echec (1, 2, 4… jusqu'a 15 s) : marteler un
 * serveur qui redemarre le ralentit, et vide la batterie pour rien. Elle
 * REPART A ZERO des que le telephone retrouve le reseau ou que l'application
 * revient au premier plan — ce sont les deux instants ou une nouvelle tentative
 * a le plus de chances d'aboutir.
 */
const RETENTE_MIN = 1000;
const RETENTE_MAX = 15000;
let retente = RETENTE_MIN;
let retenteTimer = 0;
let carteEchec = null;

function direEchec(e, dansMs) {
  if (!carteEchec) {
    carteEchec = document.createElement('div');
    carteEchec.className = 'pd-first on';
    document.body.appendChild(carteEchec);
  }
  carteEchec.innerHTML = `<div class="pd-first-card pd-panel">
    <h1>${t('connect.outOfReach')}</h1>
    <p>${(e && e.message) || ''}</p>
    <p class="pd-hint" id="pd-retry-in">${t('connect.retryingIn', { n: Math.ceil(dansMs / 1000) })}</p>
    <button class="dc-btn" id="pd-retry-now">${t('connect.retry')}</button></div>`;
  const bouton = document.getElementById('pd-retry-now');
  if (bouton) bouton.onclick = () => relancer(0);
  /* Le compte a rebours descend a l'ecran : une attente muette ressemble a un
     blocage, et c'est precisement ce qu'on essaie de faire disparaitre. */
  const ligne = document.getElementById('pd-retry-in');
  let reste = Math.ceil(dansMs / 1000);
  const tic = setInterval(() => {
    reste -= 1;
    if (reste <= 0 || !document.body.contains(ligne)) { clearInterval(tic); return; }
    ligne.textContent = t('connect.retryingIn', { n: reste });
  }, 1000);
}

function relancer(dans) {
  if (retenteTimer) { clearTimeout(retenteTimer); retenteTimer = 0; }
  retenteTimer = setTimeout(() => {
    retenteTimer = 0;
    essayer();
  }, Math.max(0, dans));
}

function essayer() {
  return start().then(() => {
    if (carteEchec) { carteEchec.remove(); carteEchec = null; }
    retente = RETENTE_MIN;
  }).catch((e) => {
    splashOff();
    direEchec(e, retente);
    relancer(retente);
    retente = Math.min(RETENTE_MAX, retente * 2);
  });
}

/* Deux evenements valent mieux qu'une minuterie : le retour du reseau et le
   retour au premier plan sont les deux instants ou une tentative aboutit. */
window.addEventListener('online', () => { retente = RETENTE_MIN; relancer(0); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && carteEchec) { retente = RETENTE_MIN; relancer(0); }
});

essayer();
