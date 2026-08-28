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
import { messageServeur } from './dice_refus.js';
import { uiConfirm } from '../ui/dialogs.js';
import { DiceNet, diceStatus } from './dice_net.js';
import { Sfx } from './dice_board.js';
import { Musique } from '../ui/musique.js';
import { facteur, surVolume, volumes, reglerVolume, DEFAUT } from '../ui/volumes.js';
import { niveauCanal } from '../ui/bus_audio.js';
import { S, UI, ASSETS, PIECE_MAUDITE, screen, bonusArt, preloadAssets } from './dice_state.js';
import { onMatch, onState, renderBonusRack } from './dice_match.js';
import { onOver } from './dice_end.js';
import { renderRules, renderShop, renderRanking, renderSucces } from './dice_panels.js';
import { renderReplays, ouvrirRejeu, fermerLecteur } from './dice_replay.js';
import { renderMenu, onRoom, onRoomFail, resetLobby, repeindreCapitaines } from './dice_lobby.js';

/* Les pages laterales, dans l'ordre ou on les rencontre : ce qu'on achete, ou
   l'on se situe, ce qu'on a accompli, ce qu'on a joue, et enfin les regles —
   qu'on ne relit qu'une fois. */
const ONGLETS = [
  { id: 'shop', cle: 'tab.shop', art: 'icon_shop' },
  { id: 'ranking', cle: 'tab.ranking', art: 'icon_ranking' },
  { id: 'succes', cle: 'tab.succes', art: 'icon_succes' },
  /* ⚠️ « JOURNAL DE BORD » NE TIENT PAS SUR UN SIXIEME D'ECRAN, et un libelle
     coupe par des points de suspension est pire qu'un libelle court : il donne
     l'impression que l'ecran est trop petit pour le jeu. La page, elle, garde
     son nom entier — c'est la barre qui abrege, pas le lieu. */
  { id: 'replay', cle: 'tab.replay', court: 'nav.replay', art: 'icon_replay' },
  { id: 'rules', cle: 'tab.rules', art: 'icon_rules' },
];

function shellMarkup() {
  return `
  <div class="dc-shell">
    <!-- ⚠️ EN HAUT, CE QU'ON REGARDE ; EN BAS, CE QU'ON TOUCHE. Le bandeau
         portait tout : le titre, la bourse, les cinq pages, les reglages et la
         sortie. Sur un telephone tenu d'une main, le haut de l'ecran est
         precisement l'endroit que le pouce n'atteint pas — on y mettait donc la
         navigation, et on gardait sous la main... rien. Le haut ne garde plus
         que ce qui se LIT d'un coup d'oeil : le classement et les deux bourses.
         Tout ce qui se touche descend. -->
    <header class="dc-top">
      <div class="dc-wallet" id="dc-wallet"></div>
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
    <!-- ⚠️ LA BARRE DU BAS EST DANS LA ZONE DU POUCE, et elle porte le mot avec
         le dessin : la place ne manque plus en largeur, et un mot lu une fois
         apprend ce que le dessin voudra dire ensuite. Elle reste HORS du corps
         defilant pour ne pas partir avec lui — une navigation qui s'en va quand
         on descend n'est plus une navigation. -->
    <nav class="dc-bas" id="dc-bas">${ONGLETS.map((o) => `
      <button class="dc-onglet" data-panel="${o.id}"
              title="${esc(t(o.cle))}" aria-label="${esc(t(o.cle))}"
      ><img src="${ASSETS}img/${o.art}.png" alt=""><span>${esc(t(o.court || o.cle))}</span></button>`).join('')}
    </nav>
  </div>`;
}

function build() {
  if (S.built) return;
  const wrap = $('#dicewrap');
  wrap.innerHTML = shellMarkup();

  S.sfx = new Sfx(ASSETS + 'sfx/');
  /* ⚠️ `coin` est le son des PIECES (achat, gain), `dice` celui du DE. La pose
     d'un de jouait dropCoin.mp3 : on entendait de la monnaie tomber sur le
     plateau. Les noms disent maintenant ce qu'ils sont.

     ⚠️ ET UN NOM PAR EVENEMENT, PAS PAR FICHIER. Le jeu appelle `play('dice')`
     sans savoir quel echantillon est derriere : changer de banque de sons se
     fait alors ici, en une ligne, et pas dans dix fichiers. */
  /* ⛔ LE LANCER ET LA POSE REPRENNENT LEUR ANCIEN SON. Ceux de la nouvelle
     banque roulent plus longtemps et plus haut : entendus a chaque tour, ils
     « donnent mal a la tete ». Un son qui revient cinquante fois par partie n'a
     pas le droit d'etre brillant — c'est la premiere qualite qu'on lui demande,
     avant d'etre beau.
     ⚠️ ET LA POSE REDEVIENT LE MEME ECHANTILLON, JOUE PLUS SEC : c'est ce
     qu'elle etait, et c'est ce que l'oreille attend. Un seul de qui claque,
     deux gestes, une seule matiere. */
  S.sfx.load('dice', 'diceDrop.mp3');
  S.sfx.load('coin', 'coin_reward.mp3');
  S.sfx.load('boom', 'explosion.mp3');
  /* Le depart aussi reprend l'ancien : c'est le son qu'on entend en ouvrant une
     partie, et l'oreille l'associe deja au jeu. */
  S.sfx.load('start', 'begin.mp3');
  S.sfx.load('open', 'ui_open.mp3');
  S.sfx.load('shut', 'ui_close.mp3');
  S.sfx.load('tour', 'your_turn.mp3');
  S.sfx.load('effet', 'bonus_activate.mp3');
  S.sfx.load('gel', 'ice_crack.mp3');
  S.sfx.load('degel', 'ice_break.mp3');
  S.sfx.load('trouve', 'match_found.mp3');
  S.sfx.load('gagne', 'victory_stinger.mp3');
  S.sfx.load('perdu', 'defeat_stinger.mp3');
  S.sfx.load('nul', 'draw_stinger.mp3');
  S.sfx.load('onglet', 'ui_tab.mp3');

  /* La musique est un canal a part : elle boucle, elle survit aux changements
     d'ecran, et elle se tait quand l'application passe derriere. */
  S.musique = new Musique(ASSETS + 'music/');

  $('#dc-close').onclick = () => requestClose();
  $('#dc-full').onclick = () => toggleFull();
  /**
   * ⚠️ CE BOUTON EST UN RACCOURCI, PAS UN REGLAGE CONCURRENT. Le detail se fait
   * aux deux curseurs des reglages (effets / musique) ; lui coupe tout d'un
   * geste, ce qu'on veut pouvoir faire sans ouvrir un menu — quelqu'un entre
   * dans la piece, le telephone se tait.
   *
   * ⛔ ET IL DOIT MONTRER LE VRAI SILENCE, D'OU QU'IL VIENNE. Un joueur qui
   * ramene ses deux curseurs a zero n'entend plus rien : laisser le
   * haut-parleur du bandeau allume ferait mentir la seule indication visible.
   * On peint donc l'etat REEL — coupure generale ou deux canaux a zero — et non
   * l'etat de l'interrupteur.
   */
  const silence = () => {
    if (S.sfx && S.sfx.muted) return true;
    const v = volumes();
    return !v.effets && !v.musique;
  };
  const peindreMute = () => {
    const off = silence();
    $('#dc-mute').classList.toggle('dc-icon-off', off);
    $('#dc-mute').title = t(off ? 'hdr.unmute' : 'hdr.mute');
    const hp = $('#dc-mute img');
    if (hp) hp.src = ASSETS + 'img/icon_sound_' + (off ? 'off' : 'on') + '.png';
  };
  $('#dc-mute').onclick = () => {
    const off = silence();
    S.sfx.muted = !off;
    if (S.musique) S.musique.muted = S.sfx.muted;
    /* Retablir le son alors que les deux curseurs sont a zero ne rendrait
       rien : on les remonte a leur position d'usine, sinon le bouton semble
       casse. */
    if (off) {
      const v = volumes();
      if (!v.effets && !v.musique) {
        reglerVolume('effets', DEFAUT.effets);
        reglerVolume('musique', DEFAUT.musique);
      }
    }
    peindreMute();
  };

  /* ⚠️ LE REGLAGE DU JOUEUR S'APPLIQUE ICI, ET UNE SEULE FOIS. `surVolume`
     rappelle tout de suite la fonction : cet abonnement sert donc a la fois de
     reprise du reglage enregistre au lancement et de reaction au curseur qu'on
     bouge dans les reglages, sans deux chemins a garder d'accord. Les modales
     de reglages n'ont, elles, rien a savoir de `S`.
     ⛔ IL SE POSE APRES `peindreMute`, PAS AVANT : la fonction est declaree en
     `const`, et l'appel immediat de `surVolume` tomberait dans sa zone morte —
     l'erreur serait avalee par le try de l'abonnement, et le reglage
     enregistre ne serait jamais applique au lancement. */
  surVolume(() => {
    /* ⛔ LE NIVEAU QUI COMPTE EST CELUI-CI. Les deux gains du bus agissent sur
       le signal ; les deux lignes suivantes ne servent qu'au chemin de secours,
       la ou Web Audio manque. Sur iOS, elles ne font RIEN — c'etait tout le
       bug : le reglage s'ecrivait et mourait avant le haut-parleur. */
    niveauCanal('effets', facteur('effets'));
    niveauCanal('musique', facteur('musique'));
    if (S.sfx) S.sfx.niveau = facteur('effets');
    if (S.musique) S.musique.volume = facteur('musique');
    peindreMute();
  });
  wrap.querySelectorAll('.dc-tab, .dc-onglet').forEach((b) => {
    b.onclick = () => { if (S.sfx) S.sfx.play('onglet', 0.22); togglePanel(b.dataset.panel); };
  });

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
      if (Array.isArray(m.captains) && m.captains.length) S.captains = m.captains;
      renderWallet();
      showMenu();
    },
    me: (m) => {
      S.me = m.me; S.inventory = m.inventory || [];
      /* Le bandeau des capitaines depend de `games` et du capitaine porte : il
         se repeint avec la bourse, sinon un refus du serveur ou une partie de
         plus laisserait un cadenas perime a l'ecran. */
      renderWallet(); repeindreCapitaines(); refreshPanel(); renderBonusRack();
    },
    /* Le serveur peut renvoyer la liste en cours de session (seuils modifies,
       nouveau capitaine) : on la prend, l'ecran suivant la lira. */
    captains: (m) => { if (Array.isArray(m.captains) && m.captains.length) S.captains = m.captains; },
    /* La liste arrive apres l'avoir demandee : on la range et on repeint si la
       page est encore ouverte — le joueur a pu changer d'onglet entre-temps. */
    historique: (m) => {
      S.historique = Array.isArray(m.liste) ? m.liste : [];
      if (S.panel === 'replay') refreshPanel();
    },
    rejouer: (m) => ouvrirRejeu(m.partie),
    succes: (m) => {
      S.succes = Array.isArray(m.liste) ? m.liste : [];
      if (S.me && typeof m.premium === 'number') { S.me.premium = m.premium; renderWallet(); }
      if (S.panel === 'succes') refreshPanel();
    },
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
    /* ⛔ ET UN REFUS DOIT DEFAIRE CE QUE L'ECRAN AVAIT DEJA PEINT. Le choix du
       capitaine s'allume avant la reponse du serveur — c'est voulu, attendre
       donnerait un ecran qui hesite. Mais depuis que le serveur peut REFUSER un
       capitaine pas encore gagne, l'optimisme devient un mensonge : le
       medaillon restait allume jusqu'au message suivant. On redemande donc
       l'etat, qui repeindra la verite. */
    error: (m) => {
      toast(messageServeur(m.msg), 'warn');
      rendreLaMain();
      /* `refresh` est le message qui existe : il renvoie un `me` frais, et
         c'est `me` qui repeint le pont. Il n'y a pas de message `me` entrant —
         l'inventer aurait produit un refus « unknown message » par-dessus le
         premier refus. */
      if (m.msg === 'captain locked' && S.net) S.net.send({ t: 'refresh' });
    },
    denied: (m) => connectFailed(m.msg || 'the game server refused the token'),
    closed: (byUs) => {
      /* ⚠️ `S.net` DOIT TOMBER AVEC LA CONNEXION. La relance automatique et les
         panneaux verifient sa presence pour savoir s'ils peuvent parler : le
         laisser en place derriere une socket morte, c'est promettre un canal
         qui n'existe plus. */
      if (byUs) return;
      S.net = null;
      if (!S.open) return;
      /* ⛔ ON NE MONTRE PLUS LA PAGE D'ECHEC AU PREMIER SOUFFLE. « Je ferme mon
         telephone, je le rouvre, et j'ai une page qui me dit serveur
         indisponible » : la socket ne survit pas a la mise en veille, c'est
         normal — ce qui ne l'est pas, c'est de traiter ce reveil comme une
         panne. On se rebranche en silence ; l'ecran d'echec n'apparait que si
         plusieurs tentatives echouent vraiment. */
      relancerPlusTard();
    },
  });

  try { await S.net.connect(); }
  catch (e) { connectFailed(e.message); }
}



/* Rouvrir ce qu'un envoi avait ferme par avance.
   ⚠️ ELLE EST VIDE, ET C'EST VOULU. Son seul client etait le bouton de mise, qui
   se desactivait a l'envoi et restait mort quand le serveur refusait — la partie
   paraissait figee. La mise n'existe plus, mais la lecon reste : tout bouton qui
   se ferme en attendant une reponse doit se rouvrir ici, et le gestionnaire
   d'erreur l'appelle deja. La garder vide coute une ligne ; la supprimer coute
   de reapprendre le defaut. */
function rendreLaMain() {}

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

/* Combien de tentatives silencieuses avant d'afficher l'echec. Trois suffisent :
   un reveil de telephone se rattrape a la premiere, une vraie panne se voit a la
   troisieme, et entre les deux le joueur ne lit rien d'inquietant. */
const RELANCE_MUETTE = 3;
let relanceEssais = 0;

function arreterRelance() {
  if (relanceTimer) { clearTimeout(relanceTimer); relanceTimer = 0; }
  relanceDelai = RELANCE_MIN;
  relanceEssais = 0;
}

function relancerPlusTard() {
  if (relanceTimer) return;                     // une seule tentative en vol
  const dans = relanceDelai;
  relanceDelai = Math.min(RELANCE_MAX, relanceDelai * 2);
  relanceEssais += 1;
  const bruyant = relanceEssais > RELANCE_MUETTE;
  relanceTimer = setTimeout(() => {
    relanceTimer = 0;
    if (!S.open) return;                        // le joueur est parti : on se tait
    if (bruyant) { connectFailed(t('connect.dropped')); return; }
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
    .then((yes) => {
      if (!yes) return;
      /* ⚠️ QUITTER RAMENAIT AU MENU… PUIS OUVRAIT LA CARTE DE FIN PAR-DESSUS.
         Le serveur declare forfait et annonce la fin AUX DEUX JOUEURS — c'est
         ce qu'il doit faire, l'adversaire a besoin de le savoir. Mais celui qui
         part, lui, vient de decider : lui montrer « defaite, rejouer ? » sur le
         menu qu'il a demande, c'est lui redonner un ecran dont il sortait.
         On note donc qu'on part de son plein gre, et on laisse passer la
         prochaine annonce de fin — une seule, et seulement pour cette partie. */
      S.quitting = true;
      if (S.net) S.net.send({ t: 'leave' });
      sortir();
    });
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
  if (['1', '2', '3', '4'].includes(ev.key) && S.state.dice[S.seat] !== null) {
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

/**
 * La classe de taille d'une bourse, selon le nombre de chiffres.
 *
 * ⛔ UNE BOURSE QUI GROSSIT NE DOIT PAS POUSSER LE RESTE DEHORS. « 280 » et
 * « 128 400 » n'ont pas la meme largeur, et la pastille est coincee entre le
 * nom du joueur et les onglets : au quatrieme chiffre elle mangeait le nom, au
 * sixieme elle sortait de l'ecran. On retrecit donc le texte a mesure que le
 * nombre grandit — c'est la seule facon de garder une largeur a peu pres
 * constante sans jamais tronquer un montant, ce qui serait pire que tout : un
 * joueur doit pouvoir lire ce qu'il possede, au chiffre pres.
 */
function tailleBourse(n) {
  const chiffres = String(Math.max(0, Number(n) || 0)).length;
  if (chiffres <= 3) return '';
  if (chiffres === 4) return 'dc-coins-c4';
  if (chiffres === 5) return 'dc-coins-c5';
  return 'dc-coins-c6';
}

/**
 * Le bandeau du haut : le classement et les deux bourses, rien d'autre.
 *
 * ⛔ LE NOM ET L'AVATAR SONT PARTIS, ET ILS NE MANQUENT PAS. On sait comment on
 * s'appelle ; on regarde ce bandeau pour savoir ou l'on en est. Il portait
 * aussi le bilan « 12V 8D 3N » — trois nombres qu'on ne lit jamais en cours de
 * partie et qui volaient la place aux deux seuls qui comptent. Le detail vit
 * dans le pont et dans le classement, qui sont faits pour cela.
 */
function renderWallet() {
  if (!S.me) return;
  $('#dc-wallet').innerHTML = `
    <div class="dc-rang" title="${esc(t('menu.rang'))}">
      <img class="dc-insigne" src="${ASSETS}img/icon_elo.png" alt="${esc(t('menu.rang'))}">
      <b>${S.me.rating}</b>
    </div>
    <div class="dc-bourses">
      <!-- ⚠️ LA BOURSE MAUDITE NE S'AFFICHE QUE SI ELLE EXISTE. Un compteur a
           zero, en permanence, pour une monnaie qu'on n'a pas encore
           rencontree, n'apprend rien. Elle apparait au premier haut fait — et
           cette apparition est elle-meme une recompense. -->
      ${S.me.premium ? `<div class="dc-coins dc-coins-maudites ${tailleBourse(S.me.premium)}"
        title="${esc(t('hdr.cursed'))}">${S.me.premium}${PIECE_MAUDITE}</div>` : ''}
      <div class="dc-coins ${tailleBourse(S.me.coins)}" title="${esc(t('hdr.coins'))}">${S.me.coins}
        <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>
    </div>`;
}

/* Le pont vit dans dice_lobby.js : choix du capitaine et salon prive y sont
   deux ecrans a part entiere, et ce fichier n'a pas a les porter. */
function showMenu() {
  /* Le pont a sa boucle ; l'arene aura la sienne. */
  if (S.musique) S.musique.jouer('menu');
  renderMenu($('#dc-screen-menu'));
}

/* ─────────────────────────────────────────────── shop / ranking / rules ── */

function togglePanel(name) {
  const panel = $('#dc-panel');
  if (S.panel === name) {
    S.panel = null;
    panel.classList.remove('on');
    /* ⚠️ LE LECTEUR NE SURVIT PAS A LA FERMETURE. Son horloge continuerait de
       tourner derriere un panneau invisible, a peindre des plateaux retires du
       document et a jouer des explosions que personne ne regarde. */
    fermerLecteur();
    S.sfx.play('shut', 0.2);
  } else {
    /* ⛔ PASSER A UN AUTRE ONGLET FERME AUSSI LE LECTEUR. Il n'etait ferme que
       dans la branche « on referme le meme onglet » : quitter le journal de bord
       pour la boutique laissait son horloge tourner, peindre des plateaux
       retires du document et jouer des explosions derriere un panneau qu'on ne
       regarde plus. */
    if (S.panel !== name) fermerLecteur();
    S.panel = name;
    panel.classList.add('on');
    S.sfx.play('open', 0.2);
    refreshPanel();
  }
  $('#dicewrap').querySelectorAll('.dc-tab, .dc-onglet')
    .forEach((b) => b.classList.toggle('on', b.dataset.panel === S.panel));
}

function refreshPanel() {
  if (!S.panel) return;
  const body = $('#dc-panel .dc-panel-in');
  if (S.panel === 'rules') renderRules(body);
  else if (S.panel === 'shop') renderShop(body);
  else if (S.panel === 'ranking') renderRanking(body);
  else if (S.panel === 'succes') renderSucces(body);
  else if (S.panel === 'replay') renderReplays(body);
}

/* ───────────────────────────────────────────────────────────────── wiring ── */

export function initDice() {
  UI.showMenu = showMenu;
  /* Le panneau lateral se repeint depuis l'arene : elle sait quand la partie
     commence, ce que la boutique ne peut pas deviner toute seule. */
  UI.refreshPanel = refreshPanel;
  UI.leaveMatch = () => { S.state = null; S.seat = -1; showMenu(); };
  UI.renderWallet = renderWallet;
  UI.requestClose = requestClose;
}
