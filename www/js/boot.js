/* ============================================================================
   boot.js — le demarrage de l'application.

   Le jeu (js/pages/dice*.js) est le MEME code que dans Reforged Studio. Ce
   fichier ne fait que ce qu'un telephone exige en plus : ouvrir une session sur
   le compte Google, poser la table en plein ecran, rendre le bouton RETOUR
   inoffensif, et offrir les quatre reglages du telephone.
   ============================================================================ */

import { initDice, openDice } from './pages/dice.js';
import { S, UI, ASSETS, myTurn } from './pages/dice_state.js';
import { signIn, signOut, account, eraseAccount, fournisseur } from './identity.js';
import { startFitting } from './fit.js';
import { t, LANGS, lang, setLang } from './core/i18n.js';
import { startMotion } from './motion.js';
import { toast } from './ui/toast.js';
import { uiConfirm } from './ui/dialogs.js';
import { brancherStudio } from './ui/studio.js';
import { volumes, reglerVolume, surVolume, DEFAUT } from './ui/volumes.js';

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

/* ⚠️ SUR IOS, `visibilitychange` NE SUFFIT PAS TOUJOURS. Le systeme met la vue
   web en pause a sa facon, et l'evenement du web n'arrive pas toujours quand
   l'application passe derriere. Le greffon, lui, le sait : on l'ecoute AUSSI,
   et les deux chemins font la meme chose — couper le son. */
function wireArrierePlan() {
  const cap = window.Capacitor;
  if (!cap || !cap.Plugins || !cap.Plugins.App) return;
  cap.Plugins.App.addListener('appStateChange', ({ isActive }) => {
    if (!S.sfx) return;
    S.sfx.dehors = !isActive;
    if (!isActive) S.sfx.taire();
  });
}

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

/** « 1.0 (build 33) » — ce que le telephone a REELLEMENT installe. */
function versionLisible() {
  const c = window.PD_CONFIG || {};
  /* On ne recopie que des chiffres : ce texte part dans du HTML. */
  const build = String(c.build || '').replace(/[^0-9a-z.]/gi, '');
  return '1.0' + (build ? ' (build ' + build + ')' : '');
}

function row(label, body) {
  return `<div class="pd-row"><span class="pd-row-lbl">${label}</span>${body}</div>`;
}

/**
 * Une ligne de volume : un haut-parleur qui coupe, un curseur qui dose.
 *
 * ⚠️ LE DESSIN N'EST PAS UNE DECORATION A COTE DU CURSEUR, C'EST LE BOUTON
 * « COUPER ». Amener un curseur a zero au doigt, sur un telephone, demande de
 * viser ; et il faut ensuite retrouver la position d'avant pour revenir. Un
 * appui sur le haut-parleur fait les deux, et il montre l'etat du canal sans
 * qu'on ait a lire le pour-cent.
 */
function volRow(canal, label, valeur) {
  const off = valeur === 0;
  return `<div class="pd-row pd-vol" data-vol="${canal}">
    <span class="pd-row-lbl">${label}</span>
    <button class="pd-vol-btn${off ? '' : ' on'}" data-vol-mute aria-pressed="${!off}"
            title="${t(off ? 'set.soundOff' : 'set.soundOn')}"
            aria-label="${label} — ${t(off ? 'set.soundOff' : 'set.soundOn')}"><img
            src="${ASSETS}img/icon_sound_${off ? 'off' : 'on'}.png" alt=""></button>
    <input class="pd-vol-slider" type="range" min="0" max="100" step="5"
           value="${valeur}" data-vol-range style="--pd-vol-fill:${valeur}%"
           aria-label="${label}" aria-valuetext="${valeur} %">
    <span class="pd-vol-val" data-vol-val>${valeur} %</span>
  </div>`;
}

function settingsMarkup() {
  const acc = account();
  const who = acc.google ? t('set.signedInAs', { name: acc.name }) : t('set.guest');
  /* Le libelle ET le dessin nomment le fournisseur de CETTE plateforme :
     « avec Google » sur un iPhone serait faux, et « avec Apple » sur Android
     n'existe pas. Le logo dit lequel avant meme qu'on ait lu. */
  const pomme = fournisseur() === 'apple';
  /* ⚠️ CHANGER DE COMPTE EN PLEINE PARTIE, C'EST PERDRE LA PARTIE. Se connecter,
     se deconnecter ou effacer son compte refont la session : la liaison tombe,
     le siege est declare abandonne, et la mise part avec. Rien ne l'empechait —
     les reglages s'ouvrent par-dessus le plateau. On barre donc les deux boutons
     tant qu'un duel est en cours, en DISANT pourquoi : un bouton grise et muet
     laisserait croire a une panne. */
  const enPartie = !!(S.state && S.state.phase && S.state.phase !== 'over');
  /* ⚠️ LA PHRASE ENTIERE NE TIENT PAS SUR UN DEMI-BOUTON. « Se connecter avec
     Google » et « Effacer mes donnees et mon compte » se repliaient sur trois
     lignes dans deux boutons cote a cote, et le dessin se retrouvait ecrase
     contre un pave de texte — retour de l'admin, capture a l'appui. Le mot
     court s'affiche, la phrase complete reste dans `title` : elle est encore la
     pour le lecteur d'ecran et pour qui hesite. */
  const barre = enPartie ? ' disabled' : '';
  const dit = (phrase) => (enPartie ? t('set.notInMatch') : phrase);
  const button = acc.google
    ? `<button class="dc-btn dc-btn-sm dc-btn-ghost dc-btn-art" data-signout${barre}
               title="${dit(t('set.signOut'))}" aria-label="${dit(t('set.signOut'))}">
         <img src="${ASSETS}img/icon_link.png" alt="">${t('set.signOutShort')}</button>`
    : `<button class="dc-btn dc-btn-sm dc-btn-art" data-signin${barre}
               title="${dit(t(pomme ? 'set.signInApple' : 'set.signIn'))}"
               aria-label="${dit(t(pomme ? 'set.signInApple' : 'set.signIn'))}">
         <img src="${ASSETS}img/icon_${pomme ? 'apple' : 'google'}.png" alt="">${
        t('set.signInShort')}</button>`;
  const vol = volumes();

  return `
    <div class="pd-ask-card pd-panel pd-set">
      <h3>${t('set.title')}</h3>

      <!-- ⛔ UN SEUL INTERRUPTEUR POUR TOUT LE SON, C'ETAIT TROP PEU. Le joueur
           que la musique derange n'avait qu'un geste : tout eteindre, y compris
           le claquement du de qui lui dit que son coup est parti. Les deux
           canaux se reglent maintenant separement, et le haut-parleur de chaque
           ligne coupe le sien — le bouton du bandeau de jeu, lui, coupe encore
           les deux d'un coup. -->
      ${volRow('effets', t('set.fx'), vol.effets)}
      ${volRow('musique', t('set.music'), vol.musique)}

      <!-- Plus de reglage « jouer aux mouvements ». Secouer pour lancer est
           desormais toujours actif : un geste cache derriere un interrupteur
           n'est jamais decouvert, donc jamais utilise. -->

      ${row(t('set.account'), `<span class="pd-row-val">${who}</span>`)}
      ${enPartie ? `<p class="pd-hint">${t('set.notInMatch')}</p>` : ''}
      <div class="pd-row pd-row-btns">${button}
        <button class="dc-btn dc-btn-sm dc-btn-ghost pd-danger dc-btn-art" data-erase${barre}
                title="${dit(t('set.erase'))}" aria-label="${dit(t('set.erase'))}">
          <img src="${ASSETS}img/icon_erase.png" alt=""
               >${t('set.eraseShort')}</button>
      </div>

      ${row(t('set.language'), `<select class="pd-select" data-lang>${
        LANGS.map((l) => `<option value="${l.code}"${l.code === lang() ? ' selected' : ''}>${l.label}</option>`).join('')
      }</select>`)}

      <!-- ⚠️ LE CADRE ETOUFFAIT LE DESSIN. Le lien portait un carre sombre a
           jonc blanc de 40 px, et l'icone tenait dans 26 : un autocollant deja
           cerne de blanc, pose dans un second cerne blanc, sur un fond noir qui
           mangeait ses couleurs — « on voit mal l'icone et le rectangle autour
           pue ». On enleve le cadre et on rend au dessin sa taille : il se
           suffit, c'est pour cela qu'il a ete dessine ainsi. -->
      ${row(t('set.terms'), `<a class="pd-link-art" href="${TERMS_URL}" target="_blank"
             rel="noopener" title="${t('set.terms')}"
             aria-label="${t('set.terms')}"><img src="${ASSETS}img/icon_link.png" alt=""></a>`)}

      <!-- ⚠️ LE NUMERO DE BUILD S'AFFICHE, ET CE N'EST PAS UN DETAIL. Sans lui,
           personne — ni le testeur, ni moi — ne peut dire quelle version tourne
           sur un telephone : un correctif envoye et un correctif installe sont
           deux choses differentes, et on a perdu un aller-retour a confondre
           les deux (« j'ai encore l'ancien message » sur la build precedente).
           Il est discret, en bas, et il repond a la question d'un coup d'oeil. -->
      <div class="pd-version">${versionLisible()}</div>

      <!-- Fermer ne s'ecrit plus : la croix EST le mot. -->
      <div class="pd-ask-row"><button class="dc-btn dc-btn-art pd-btn-icone" data-close
             title="${t('set.close')}" aria-label="${t('set.close')}">
        <img src="${ASSETS}img/icon_close.png" alt=""></button></div>
    </div>`;
}

function openSettings() {
  const wrap = document.createElement('div');
  wrap.className = 'pd-ask on';
  wrap.innerHTML = settingsMarkup();
  host().appendChild(wrap);

  /* `oublier` n'existe pas encore quand `close` est ecrit — il est appele bien
     apres, au clic. Le desabonnement n'est pas une politesse : sans lui, chaque
     ouverture de reglages laisserait derriere elle un abonne qui peint des
     lignes retirees du document. */
  const close = () => { if (oublier) oublier(); wrap.remove(); };
  const back = (ev) => { ev.preventDefault(); close(); };
  document.addEventListener('pd-back', back, { once: true });
  wrap.onclick = (ev) => { if (ev.target === wrap) close(); };
  wrap.querySelector('[data-close]').onclick = close;

  /* ⚠️ ON RETIENT LE NIVEAU D'AVANT LA COUPURE, SINON « COUPER » EST UN ALLER
     SIMPLE : sans memoire, le retour se ferait au reglage d'usine et le joueur
     qui avait pose sa musique a 20 % la retrouverait a 60. La memoire ne vit
     que le temps de la modale — c'est exactement la duree du geste. */
  const avant = {};
  const peintres = [];
  wrap.querySelectorAll('[data-vol]').forEach((ligne) => {
    const canal = ligne.dataset.vol;
    const btn = ligne.querySelector('[data-vol-mute]');
    const curseur = ligne.querySelector('[data-vol-range]');
    const chiffre = ligne.querySelector('[data-vol-val]');
    const nom = ligne.querySelector('.pd-row-lbl').textContent;

    const peindre = (v) => {
      const off = v === 0;
      curseur.value = String(v);
      /* Le remplissage dore de la piste : WebKit ne le calcule pas tout seul. */
      curseur.style.setProperty('--pd-vol-fill', v + '%');
      curseur.setAttribute('aria-valuetext', v + ' %');
      chiffre.textContent = v + ' %';
      btn.classList.toggle('on', !off);
      btn.setAttribute('aria-pressed', String(!off));
      btn.setAttribute('title', t(off ? 'set.soundOff' : 'set.soundOn'));
      btn.setAttribute('aria-label', nom + ' — ' + t(off ? 'set.soundOff' : 'set.soundOn'));
      /* ⚠️ `textContent` EFFACERAIT LE DESSIN : le bouton n'a qu'une image. */
      const img = btn.querySelector('img');
      if (img) img.src = ASSETS + 'img/icon_sound_' + (off ? 'off' : 'on') + '.png';
      ligne.classList.toggle('pd-vol-off', off);
    };

    peintres.push(() => peindre(volumes()[canal]));

    /* ⚠️ LE SON DOIT SUIVRE LE DOIGT, PAS LE LACHER. `input` se declenche
       pendant le glissement : c'est ce qui permet de regler A L'OREILLE, seule
       facon honnete de choisir un volume. `change` seul aurait demande de
       lacher, ecouter, reprendre. */
    curseur.oninput = () => {
      const v = reglerVolume(canal, curseur.value);
      demuter();
      peindre(v);
    };
    /* Le repere sonore ne se donne qu'au relachement : un echantillon a chaque
       pas de 5 % pendant le glissement serait un hachis. */
    curseur.onchange = () => {
      if (canal === 'effets' && S.sfx) S.sfx.play('pose', 0.42, 1.28);
    };

    btn.onclick = () => {
      const v = volumes()[canal];
      if (v > 0) { avant[canal] = v; peindre(reglerVolume(canal, 0)); return; }
      demuter();
      peindre(reglerVolume(canal, avant[canal] || DEFAUT[canal]));
    };
  });

  /**
   * ⚠️ MONTER UN CURSEUR SANS RIEN ENTENDRE FAIT PASSER LE REGLAGE POUR CASSE.
   * Le bandeau de jeu garde son interrupteur general ; s'il est coupe, toucher
   * un curseur est une demande d'entendre — on leve donc la coupure generale
   * au passage, plutot que de laisser le joueur chercher pourquoi son geste
   * n'a produit aucun son.
   */
  function demuter() {
    if (!S.sfx || !S.sfx.muted) return;
    const mute = document.getElementById('dc-mute');
    if (mute) mute.click(); else S.sfx.muted = false;
  }

  /* ⛔ DEUX VUES DU MEME REGLAGE DOIVENT BOUGER ENSEMBLE. Le haut-parleur du
     bandeau de jeu reste atteignable, la modale ouverte : couper le son par la
     laissait les deux curseurs affiches a leur ancienne position, c'est-a-dire
     un ecran qui ment sur ce qu'on vient de faire. On s'abonne donc au reglage
     lui-meme — il n'y a qu'une verite, et les deux vues la lisent. */
  const oublier = surVolume(() => peintres.forEach((fn) => fn()));

  /**
   * ⚠️ RECHARGER EN PLEINE PARTIE COUTE LA PARTIE. `location.reload()` coupe la
   * liaison, refait une session et renvoie le joueur au menu : changer de langue
   * au milieu d'un duel faisait perdre la table, avec une erreur de serveur au
   * passage. Vu a l'ecran le 2026-08-23.
   *
   * Hors partie, on recharge : c'est le plus sur, et rien n'est en cours. En
   * partie, on ne recharge PAS — l'ecran de jeu se retraduit tout seul au
   * prochain etat envoye par le serveur, parce que `paint()` rappelle `t()` a
   * chaque fois. Ce qui reste dans l'ancienne langue, ce sont les quelques
   * libelles poses une seule fois a la construction ; ils reviennent en ordre a
   * la partie suivante.
   */
  wrap.querySelector('[data-lang]').onchange = (ev) => {
    setLang(ev.target.value);
    if (!S.state) { location.reload(); return; }
    close();
    toast(t('set.language') + ' ✓');
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
  /* ⚠️ `&times;` N'EST PAS NOTRE CROIX. C'etait un glyphe de la police du
     systeme — fin, gris, different sur chaque telephone — au milieu d'un jeu
     ou tout le reste est dessine. Le jeu a SA croix ; c'est elle qu'on pose. */
  bar.innerHTML = '<span class="pd-sheet-spacer"></span><span class="pd-grab"></span>'
    + '<button class="pd-sheet-close" title="' + t('set.close') + '" aria-label="'
    + t('set.close') + '"><img src="' + ASSETS + 'img/icon_close.png" alt=""></button>';
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
  wireArrierePlan();
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
  /* ⚠️ APRES LE RIDEAU, PAS AVANT. Chercher l'atelier coute deux requetes qui
     echouent sur un vrai telephone : les faire au demarrage retarderait
     l'ouverture du jeu pour une fonction que personne n'utilise en jouant. */
  brancherStudio().then((la) => { if (la) console.log('[studio] atelier branche'); });
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
