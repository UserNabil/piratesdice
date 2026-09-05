/* ============================================================================
   boot.js — le demarrage de l'application.

   Le jeu (js/pages/dice*.js) est le MEME code que dans Reforged Studio. Ce
   fichier ne fait que ce qu'un telephone exige en plus : ouvrir une session sur
   le compte Google, poser la table en plein ecran, rendre le bouton RETOUR
   inoffensif, et offrir les quatre reglages du telephone.
   ============================================================================ */

import { initDice, openDice, ouvrirPanneau } from './pages/dice.js';
import { rejoindreParLien } from './pages/dice_lobby.js';
import { S, UI, ASSETS, myTurn } from './pages/dice_state.js';
import { retourContexte, ouvrirContexte } from './core/contexte.js';
import { signIn, signOut, account, eraseAccount, fournisseur } from './identity.js';
import { startFitting } from './fit.js';
import { t, LANGS, lang, setLang } from './core/i18n.js';
import { startMotion } from './motion.js';
import { toast } from './ui/toast.js';
import { uiConfirm } from './ui/dialogs.js';
import { brancherStudio } from './ui/studio.js';
import { lancerTutoriel } from './ui/tour.js';
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

/**
 * LES LIENS D'INVITATION : piratesdice://rejoindre?code=XXXXX
 *
 * ⚠️ DEUX CHEMINS, ET IL FAUT LES DEUX. `appUrlOpen` couvre le cas ou le jeu
 * tourne deja ; `getLaunchUrl` celui ou le lien VIENT DE LE DEMARRER — dans ce
 * cas l'adresse est arrivee avant que le moindre ecouteur existe, et l'evenement
 * ne se rejouera jamais. N'en brancher qu'un revient a perdre une invitation sur
 * deux, selon que l'ami avait le jeu ouvert ou non.
 */
function brancherLiens() {
  const cap = window.Capacitor;
  const app = cap && cap.Plugins && cap.Plugins.App;
  if (!app) return;
  const code = (url) => {
    try {
      const u = new URL(String(url || ''));
      return (u.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    } catch (_) { return ''; }
  };
  app.addListener('appUrlOpen', (ev) => {
    const c = code(ev && ev.url);
    if (c) rejoindreParLien(c);
  });
  if (typeof app.getLaunchUrl === 'function') {
    app.getLaunchUrl()
      .then((r) => { const c = code(r && r.url); if (c) rejoindreParLien(c); })
      .catch(() => { /* pas de lien de lancement : c'est le cas ordinaire */ });
  }
}

function wireBackButton() {
  const fire = () => {
    /* ⛔ LA PILE DES CONTEXTES PASSE EN PREMIER. Une modale ouverte se ferme,
       et RIEN d'autre ne bouge — quel que soit l'ordre dans lequel les
       ecouteurs historiques se sont inscrits. Voir core/contexte.js. */
    if (retourContexte()) return true;
    const ev = new CustomEvent('pd-back', { cancelable: true });
    document.dispatchEvent(ev);
    return ev.defaultPrevented;
  };
  const cap = window.Capacitor;
  if (cap && cap.Plugins && cap.Plugins.App) {
    cap.Plugins.App.addListener('backButton', () => {
      if (fire()) return;
      /* ⛔ IL CHERCHAIT `.dc-tab.on`, QUI N'EXISTE PLUS. C'etait la classe des
         onglets du bandeau du haut ; depuis que la navigation est passee en bas,
         le selecteur ne trouvait rien et le bouton RETOUR sautait cette branche
         — sur une page ouverte, il tombait donc sur la sortie de partie ou sur
         la fermeture de l'application. Retour, depuis une page, ramene a
         l'accueil : c'est le seul sens qu'il puisse avoir ici. */
      const page = document.querySelector(
        '#dicewrap .dc-onglet.on[data-panel]:not([data-panel="accueil"])');
      if (page) {
        const accueil = document.querySelector('#dicewrap .dc-onglet[data-panel="accueil"]');
        if (accueil) { accueil.click(); return; }
      }
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
  /* ⚠️ CHAQUE CANAL A SON DESSIN, ET C'EST LE SEUL REPERE QUI SE LIT DE LOIN.
     Deux haut-parleurs identiques l'un sous l'autre obligeaient a lire le
     libelle pour savoir lequel on coupait. Le pavillon bleu pour les effets, la
     note rouge pour la musique : ils ont ete dessines pour ca. */
  const art = canal === 'musique' ? 'music' : 'sound';
  return `<div class="pd-row pd-vol" data-vol="${canal}" data-vol-art="${art}">
    <span class="pd-row-lbl">${label}</span>
    <input class="pd-vol-slider" type="range" min="0" max="100" step="5"
           value="${valeur}" data-vol-range style="--pd-vol-fill:${valeur}%"
           aria-label="${label}" aria-valuetext="${valeur} %">
    <span class="pd-vol-val" data-vol-val>${valeur} %</span>
    <button class="pd-vol-btn" data-vol-mute aria-pressed="${!off}"
            title="${t(off ? 'set.soundOff' : 'set.soundOn')}"
            aria-label="${label} — ${t(off ? 'set.soundOff' : 'set.soundOn')}"><img
            src="${ASSETS}img/icon_${art}_${off ? 'off' : 'on'}.png" alt=""></button>
  </div>`;
}

function settingsMarkup() {
  const acc = account();
  /* ⛔ LE NOM AFFICHE EST CELUI DU SERVEUR, PAS CELUI DU CACHE. La session
     d'identite garde le nom du jour de la connexion : apres un renommage, la
     modale montrait l'ancien — « je change de pseudo et ca ne change rien ».
     `S.me` est repeint a chaque message `me` ; c'est lui qui dit vrai. */
  const nomVif = (S.me && S.me.name) || acc.name;
  const who = acc.google ? t('set.signedInAs', { name: nomVif }) : t('set.guest');
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
  /* ⛔ UNE PARTIE SOLO NE BARRE RIEN — c'est ce qui a fait rejeter l'app par
     Apple (« items on the settings page were all unresponsive »). Au PREMIER
     lancement, le tutoriel ouvre une VRAIE partie d'entrainement (mode solo,
     phase `playing`) : `enPartie` devenait vrai, et les boutons Connexion /
     Effacer / Capitaine sortaient `disabled` — donc inertes, precisement ce que
     le testeur Apple essaie en premier (Se connecter avec Apple). Le garde
     n'existe que pour ne pas PERDRE une partie CLASSEE en se reconnectant : une
     partie solo n'a rien en jeu, on l'exclut. */
  const enPartie = !!(S.state && S.state.phase && S.state.phase !== 'over'
                      && S.state.mode !== 'solo');
  /* ⚠️ LA PHRASE ENTIERE NE TIENT PAS SUR UN DEMI-BOUTON. « Se connecter avec
     Google » et « Effacer mes donnees et mon compte » se repliaient sur trois
     lignes dans deux boutons cote a cote, et le dessin se retrouvait ecrase
     contre un pave de texte — retour de l'admin, capture a l'appui. Le mot
     court s'affiche, la phrase complete reste dans `title` : elle est encore la
     pour le lecteur d'ecran et pour qui hesite. */
  const barre = enPartie ? ' disabled' : '';
  const dit = (phrase) => (enPartie ? t('set.notInMatch') : phrase);
  /* ⛔ LE BOUTON « SE CONNECTER AVEC APPLE » SUIT LES REGLES D'APPLE, sinon rejet
     (Guideline 4 : « logo artwork that is not downloaded from Apple Design
     Resources »). Plus de PNG maison : logo Apple officiel (le glyphe), texte
     COMPLET « Se connecter avec Apple », fond noir, contenu blanc. Voir la classe
     `.dc-signin-apple`. Le bouton Google, lui, n'a pas ete mis en cause. */
  const boutonConnexion = pomme
    ? `<button class="dc-signin-apple" data-signin${barre}
               title="${dit(t('set.signInApple'))}" aria-label="${dit(t('set.signInApple'))}">
         <svg class="dc-apple-mark" viewBox="0 0 814 1000" aria-hidden="true" focusable="false"><path fill="currentColor" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.6-71.2z"/></svg>
         <span>${t('set.signInApple')}</span></button>`
    : `<button class="dc-btn dc-btn-sm dc-btn-art" data-signin${barre}
               title="${dit(t('set.signIn'))}" aria-label="${dit(t('set.signIn'))}">
         <img src="${ASSETS}img/icon_google.png" alt="">${t('set.signInShort')}</button>`;
  const button = acc.google
    ? `<button class="dc-btn dc-btn-sm dc-btn-ghost dc-btn-art" data-signout${barre}
               title="${dit(t('set.signOut'))}" aria-label="${dit(t('set.signOut'))}">
         <img src="${ASSETS}img/icon_link.png" alt="">${t('set.signOutShort')}</button>`
    : boutonConnexion;
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

      <!-- ⛔ LE PSEUDO SE CHANGE ICI. Deux a dix caracteres, unique, et le
           serveur juge (longueur, caracteres, insultes, doublon) : le client ne
           fait que limiter la saisie et montrer la reponse. Hors reseau, le
           serveur ne repond pas — la ligne reste, le refus viendra du toast. -->
      ${row(t('set.pseudo'), `<input class="pd-select pd-pseudo" data-pseudo type="text"
             maxlength="10" value="${nomVif ? String(nomVif).replace(/"/g, '&quot;') : ''}"
             aria-label="${t('set.pseudo')}" placeholder="${t('set.pseudoAide')}">
        <button class="pd-pseudo-ok" data-pseudo-ok
                title="${t('set.save')}" aria-label="${t('set.save')}">${t('set.save')}</button>`)}

      <!-- ⛔ ET LE CAPITAINE PAR DEFAUT AUSSI. Le pont sait deja le changer ;
           les reglages offrent le meme choix sans quitter la modale. Seuls les
           capitaines DEBLOQUES apparaissent — le serveur refuse les autres de
           toute facon. En partie, on ne change pas d'equipage (meme regle que
           le compte). -->
      ${row(t('set.captainDefault'), `<select class="pd-select" data-capitaine${barre}>${
        (S.captains || []).filter((c) => (Number(S.me && S.me.games) || 0) >= (Number(c.seuil) || 0))
          .map((c) => `<option value="${c.id}"${S.me && S.me.captain === c.id ? ' selected' : ''}>${
            t('cap.' + c.id + '.name')}</option>`).join('')
      }</select>`)}

      ${row(t('set.language'), `<select class="pd-select" data-lang>${
        LANGS.map((l) => `<option value="${l.code}"${l.code === lang() ? ' selected' : ''}>${l.label}</option>`).join('')
      }</select>`)}

      <!-- ⚠️ LE CADRE ETOUFFAIT LE DESSIN. Le lien portait un carre sombre a
           jonc blanc de 40 px, et l'icone tenait dans 26 : un autocollant deja
           cerne de blanc, pose dans un second cerne blanc, sur un fond noir qui
           mangeait ses couleurs — « on voit mal l'icone et le rectangle autour
           pue ». On enleve le cadre et on rend au dessin sa taille : il se
           suffit, c'est pour cela qu'il a ete dessine ainsi. -->
      <!-- ⚠️ LES REGLES ONT QUITTE LA BARRE DU BAS, ET ELLES ATTERRISSENT ICI.
           La barre porte l'accueil AU MILIEU : il lui faut donc un nombre pair
           de pages autour, sans quoi le bouton central n'est plus un centre. Des
           cinq pages, « Regles » est la seule ou l'on ne RETOURNE pas — la
           boutique s'enrichit, le classement bouge, les hauts faits tombent, le
           journal s'allonge ; les regles se lisent une fois. Les reglages sont
           precisement l'endroit des choses qu'on consulte rarement et qu'on doit
           pouvoir retrouver. -->
      ${row(t('tab.rules'), `<button class="pd-link-art" data-regles
             title="${t('tab.rules')}" aria-label="${t('tab.rules')}"
      ><img src="${ASSETS}img/icon_rules.png" alt=""></button>`)}

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

      <!-- Fermer ne s'ecrit plus : la croix EST le mot.

           ⛔ ET LA CROIX N'A PLUS DE PLAQUE SOUS ELLE. La classe dc-btn posait
           le bouton jaune bombe du jeu — celui de « LANCER », celui des achats —
           sous une icone qui est deja un objet fini, cernee de blanc et posee
           sur son disque rouge. Deux boutons l'un dans l'autre : le jaune
           annoncait une action importante, et l'action etait « fermer ». -->
      <div class="pd-ask-row"><button class="pd-btn-icone" data-close
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
  /* Les reglages vivent dans la pile des contextes : plus d'ecouteur pd-back
     en `{once:true}` qu'un retour etranger pouvait consommer. */
  let ctx = null;
  const close = () => {
    if (ctx) { ctx.retirer(); ctx = null; }
    if (oublier) oublier();
    wrap.remove();
  };
  ctx = ouvrirContexte('reglages', close);
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
    const art = ligne.dataset.volArt;

    const peindre = (v) => {
      const off = v === 0;
      curseur.value = String(v);
      /* Le remplissage dore de la piste : WebKit ne le calcule pas tout seul. */
      curseur.style.setProperty('--pd-vol-fill', v + '%');
      curseur.setAttribute('aria-valuetext', v + ' %');
      chiffre.textContent = v + ' %';
      btn.setAttribute('aria-pressed', String(!off));
      btn.setAttribute('title', t(off ? 'set.soundOff' : 'set.soundOn'));
      btn.setAttribute('aria-label', nom + ' — ' + t(off ? 'set.soundOff' : 'set.soundOn'));
      /* ⚠️ `textContent` EFFACERAIT LE DESSIN : le bouton n'a qu'une image, et
         c'est elle qui porte l'etat — la barre rouge est dans le dessin. */
      const img = btn.querySelector('img');
      if (img) img.src = ASSETS + 'img/icon_' + art + '_' + (off ? 'off' : 'on') + '.png';
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

  /* On ferme AVANT d'ouvrir : les regles s'affichent dans la page du jeu, et
     laisser les reglages par-dessus donnerait une feuille sous une boite de
     dialogue — le joueur toucherait le voile en croyant toucher les regles. */
  wrap.querySelector('[data-regles]').onclick = () => { close(); ouvrirPanneau('rules'); };
  /* Le pseudo part au serveur, qui repond par un `me` neuf (repeint par dice.js)
     ou par un refus deja traduit (dice_refus.js). On ne devine pas le verdict. */
  const champPseudo = wrap.querySelector('[data-pseudo]');
  const okPseudo = wrap.querySelector('[data-pseudo-ok]');
  if (okPseudo) okPseudo.onclick = () => {
    const nom = (champPseudo.value || '').trim();
    if (nom.length < 2 || nom.length > 10) { toast(t('err.nomTaille'), 'warn'); return; }
    if (!S.net) { toast(t('offline.besoinReseau'), 'warn'); return; }
    S.net.send({ t: 'rename', name: nom });
    /* ⛔ ON NE FETE PAS AVANT LA REPONSE. Le premier jet disait « pseudo mis a
       jour » des l'envoi, meme quand le serveur refusait ensuite — deux toasts
       qui se contredisent, et le joueur croit a une mise a jour fantome. On
       attend le `me` : s'il porte le nouveau nom, c'est fait ; sinon le refus
       traduit s'est deja affiche tout seul. */
    setTimeout(() => {
      if (S.me && S.me.name === nom) toast(t('set.pseudoOk'), 'ok');
    }, 1200);
  };
  const selCap = wrap.querySelector('[data-capitaine]');
  if (selCap) selCap.onchange = (ev) => {
    if (S.net) S.net.send({ t: 'captain', captain: ev.target.value });
    if (S.me) S.me.captain = ev.target.value;
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

/**
 * Le bouton des reglages, au bout de la barre du bas.
 *
 * ⚠️ IL SUIT LA NAVIGATION, PAS LA BOURSE. Il vivait dans le bandeau du haut,
 * avec le son et le plein ecran ; depuis que les pages sont descendues sous le
 * pouce, il serait reste seul en haut a droite — c'est-a-dire a l'endroit le
 * plus difficile a atteindre d'un telephone tenu d'une main, pour un bouton
 * qu'on cherche precisement quand on veut regler quelque chose.
 */
/**
 * Le bouton des reglages, sur sa plaque, au bout du bandeau du haut.
 *
 * ⚠️ IL N'EST PAS UNE PAGE, DONC IL N'EST PAS DANS LA BARRE DU BAS. Celle-ci
 * porte des lieux ou l'on va et d'ou l'on revient ; les reglages sont une boite
 * qui s'ouvre par-dessus et se referme. Les melanger apprendrait au joueur que
 * la barre du bas fait deux choses differentes.
 */
function addHeaderButtons() {
  const acts = document.querySelector('#dicewrap .dc-acts');
  if (!acts || document.getElementById('pd-settings-btn')) return;

  const gear = document.createElement('button');
  gear.className = 'dc-plaque-reglages';
  gear.id = 'pd-settings-btn';
  gear.title = t('set.title');
  gear.setAttribute('aria-label', t('set.title'));
  gear.onclick = openSettings;
  /* La modale de pause (dice.js) offre un bouton Parametres : elle passe par
     ici plutot que de simuler un clic sur un engrenage cache. */
  UI.openSettings = openSettings;
  acts.appendChild(gear);
}

/* ── les feuilles : une barre de fermeture visible ────────────────────────
   Une feuille qui monte du bas doit dire comment elle se ferme. Sans repere,
   il fallait deviner qu'un second appui sur l'onglet la refermait — ou
   connaitre le bouton RETOUR d'Android. */

/**
 * ⛔ L'APPLICATION NE SORT JAMAIS DE L'APPLICATION.
 *
 * Une WebView renvoie au navigateur du telephone tout ce qu'elle ne sait pas
 * afficher elle-meme : un lien `target="_blank"`, un `href` vers un autre
 * domaine, un `window.open`, une redirection d'un module tiers. Le joueur se
 * retrouve alors dans Safari, avec des onglets qu'il n'a pas demandes et une
 * page « connexion impossible » quand il n'a pas de reseau — c'est
 * exactement ce qui vient d'arriver, et c'est inacceptable : le jeu doit tenir
 * dans sa fenetre, hors ligne comme en ligne.
 *
 * On ferme donc la porte au niveau du document, en phase de CAPTURE — avant
 * que le clic n'atteigne le lien, et quel que soit le code qui l'a pose. Le
 * seul lien legitime du jeu, les conditions d'utilisation, passe par le
 * navigateur INTEGRE quand le telephone en offre un ; sinon il ne fait rien
 * plutot que d'ejecter le joueur.
 *
 * ⚠️ `window.open` EST NEUTRALISE AUSSI. Un plugin, une bibliotheque ou un bout
 * de code futur peut l'appeler sans passer par un lien : le seul garde-fou qui
 * tienne est celui qui ne depend de personne.
 */
function fermerLesPortes() {
  const dedans = (url) => {
    try {
      const u = new URL(url, document.baseURI);
      return u.origin === location.origin || u.protocol === 'capacitor:' || u.protocol === 'file:';
    } catch (_) { return false; }
  };

  const ouvrirDedans = async (url) => {
    const cap = window.Capacitor;
    const nav = cap && cap.Plugins && cap.Plugins.Browser;
    if (nav && typeof nav.open === 'function') {
      try { await nav.open({ url, presentationStyle: 'popover' }); return true; }
      catch (_) { /* pas de navigateur integre : on se tait */ }
    }
    return false;
  };

  document.addEventListener('click', (ev) => {
    const lien = ev.target && ev.target.closest && ev.target.closest('a[href]');
    if (!lien) return;
    const url = lien.getAttribute('href') || '';
    if (!url || url.startsWith('#')) return;
    if (dedans(url)) return;
    /* Tout ce qui sort est arrete ici. */
    ev.preventDefault();
    ev.stopPropagation();
    ouvrirDedans(lien.href).then((ok) => {
      /* ⚠️ SI LE NAVIGATEUR INTEGRE MANQUE, ON NE FAIT PAS SEMBLANT. Le lien des
         conditions doit rester JOIGNABLE — les deux boutiques l'exigent, et un
         lien mort y est un motif de refus. On rend alors la main au systeme
         plutot que de laisser le joueur devant un bouton qui ne fait rien : la
         regle « on ne sort pas de l'application » cede devant une obligation
         legale, et devant elle seule. */
      if (!ok) window.location.href = lien.href;
    });
  }, true);

  try {
    window.open = function () {
      console.warn('[porte] window.open refuse : le jeu ne sort pas de sa fenetre');
      return null;
    };
  } catch (_) { /* certaines WebViews refusent la reaffectation : le clic reste garde */ }
}

/* ⛔ LA BARRE DE FEUILLE A ETE RETIREE, AVEC SA CROIX ET SA POIGNEE. Elles
   disaient toutes les deux la meme chose — « ceci est pose par-dessus, tirez ou
   fermez » — et c'est precisement ce que les pages ne sont plus. La croix etait
   d'ailleurs MORTE depuis que la navigation est passee en bas : elle cherchait
   `.dc-tab.on`, la classe des anciens onglets du bandeau, et ne trouvait rien.
   Un bouton de fermeture qui ne ferme pas, sur chaque page, depuis la refonte.
   On quitte une page par la barre du bas, comme on y est venu. */

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
  fermerLesPortes();
  brancherLiens();
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
  /* ⛔ LE TUTORIEL, AU PREMIER LANCEMENT SEULEMENT. Apres le rideau (les cibles
     existent a l'ecran) et seulement si aucune partie n'est deja en cours —
     une reprise apres coupure ne doit pas se voir couverte d'un guide. Il ne
     s'invite qu'une fois : voir `tutorielDejaVu`. `S` n'est pas importe ici, on
     lit l'ecran — pas de partie visible = pas de plateau. */
  if (!document.querySelector('#dicewrap .dc-board .dc-cell-filled')) {
    setTimeout(() => lancerTutoriel(false), 400);
  }
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
  /* ⛔ NI L'ADRESSE DU SERVICE, NI LE MESSAGE DU MOTEUR. Cette carte affichait
     `e.message` brut : « Load failed », « cannot reach the game server at
     http://192.168.1.19:8100 ». Un joueur ne peut rien faire de l'un ni de
     l'autre, et l'adresse d'un reseau local n'a rien a faire dans une
     application distribuee. « Depuis quand un joueur voit 192.168.1.19 ? »
     La vraie cause part dans la console, ou elle sert a quelqu'un. */
  if (e) console.warn('[demarrage] echec :', (e && e.message) || e);
  carteEchec.innerHTML = `<div class="pd-first-card pd-panel">
    <h1>${t('boot.failed')}</h1>
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
