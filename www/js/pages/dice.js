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
import { ouvrirPartieHorsLigne } from './dice_solo.js';
import * as cale from './dice_cale.js';
import { renderMenu, onRoom, onRoomFail, resetLobby, repeindreCapitaines } from './dice_lobby.js';

/* Les pages laterales, dans l'ordre ou on les rencontre : ce qu'on achete, ou
   l'on se situe, ce qu'on a accompli, ce qu'on a joue, et enfin les regles —
   qu'on ne relit qu'une fois. */
/**
 * LA BARRE DU BAS : DEUX PAGES, L'ACCUEIL, DEUX PAGES.
 *
 * ⚠️ L'ACCUEIL EST AU MILIEU, DONC IL FAUT UN NOMBRE PAIR DE PAGES AUTOUR. Le
 * bouton central n'est pas decoratif : c'est le seul repere qui dit « d'ici, je
 * peux toujours revenir ». Pose de travers — deux pages d'un cote, trois de
 * l'autre — il cesse d'etre un centre et devient la troisieme icone en partant
 * de la gauche, c'est-a-dire rien du tout.
 *
 * ⛔ C'EST DONC « REGLES » QUI SORT DE LA BARRE, et pas une autre. Les quatre
 * qui restent sont des lieux ou l'on RETOURNE — la boutique s'enrichit, le
 * classement bouge, les hauts faits tombent, le journal s'allonge. Les regles,
 * elles, se lisent une fois : elles ne meritent pas un cinquieme de la
 * navigation permanente. Elles rejoignent les reglages, qui sont precisement
 * l'endroit des choses qu'on consulte rarement et qu'on doit pouvoir retrouver.
 *
 * `cote` dit quel parchemin porte l'icone : les deux dessins sont des miroirs
 * l'un de l'autre, et les prendre a l'envers ferait pencher les quatre du meme
 * cote — la barre perdrait sa symetrie, qui est tout ce qui la tient.
 */
const ONGLETS = [
  { id: 'shop', cle: 'tab.shop', art: 'icon_shop', cote: 'g' },
  { id: 'ranking', cle: 'tab.ranking', art: 'icon_ranking', cote: 'g' },
  { id: 'accueil', cle: 'nav.accueil', art: 'home', cote: 'home' },
  { id: 'succes', cle: 'tab.succes', art: 'icon_succes', cote: 'd' },
  { id: 'replay', cle: 'tab.replay', court: 'nav.replay', art: 'icon_replay', cote: 'd' },
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
    <header class="dc-top pd-panel">
      <div class="dc-wallet" id="dc-wallet"></div>
      <div class="dc-acts dc-acts-nue">
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
      <aside class="dc-panel pd-panel" id="dc-panel"><div class="dc-panel-in"></div></aside>
      <div class="dc-over" id="dc-over"></div>
    </div>
    <!-- ⚠️ LA BARRE DU BAS EST DANS LA ZONE DU POUCE, et elle reste HORS du
         corps defilant pour ne pas partir avec lui — une navigation qui s'en va
         quand on descend n'est plus une navigation.

         ⛔ ET LE MOT S'EN VA. Chaque bouton est desormais un objet DESSINE : un
         parchemin cloute pour les pages, un medaillon de corde et d'os pour
         l'accueil. Un libelle de 9,5 px pose sous un parchemin ne se lit pas —
         il salit le dessin et repete ce que le dessin dit deja. Le nom survit
         la ou il sert : dans l'infobulle et dans l'etiquette pour les lecteurs
         d'ecran. -->
    <nav class="dc-bas pd-panel" id="dc-bas">${ONGLETS.map((o) => (o.cote === 'home' ? `
      <button class="dc-onglet dc-onglet-home" data-panel="${o.id}"
              title="${esc(t(o.cle))}" aria-label="${esc(t(o.cle))}"
      ><img src="${ASSETS}img/slot_bas_home.png" alt=""></button>` : `
      <button class="dc-onglet dc-onglet-${o.cote}" data-panel="${o.id}"
              title="${esc(t(o.cle))}" aria-label="${esc(t(o.cle))}"
      ><img src="${ASSETS}img/${o.art}.png" alt=""></button>`)).join('')}
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
    b.onclick = () => {
      if (S.sfx) S.sfx.play('onglet', 0.22);
      if (b.dataset.panel === 'accueil') animerAccueil(b);
      togglePanel(b.dataset.panel);
    };
  });
  /* Au premier affichage aucune page n'est ouverte : c'est l'accueil qui est
     allume, et il doit le montrer avant qu'on ait touche quoi que ce soit. */
  marquerOnglets();

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
      /* ⚠️ ON REMPLIT LA CALE MAINTENANT, PAS QUAND ON EN AURA BESOIN. Un joueur
         qui entre dans le metro n'a plus personne a qui demander : les jetons
         doivent deja etre dans sa poche. Et les parties qui attendent partent
         dans la foulee — c'est le seul moment ou l'on est sur d'avoir le
         reseau. */
      S.net.send({ t: 'jetons' });
      /* La bulle des hauts faits doit etre juste AVANT qu'on ouvre la page. */
      S.net.send({ t: 'succes' });
      envoyerLesParties();
      cale.rangerMoi(m.me);
      /* La derniere position connue peint la plaque tout de suite ; la vraie
         arrive une fraction de seconde plus tard et la remplace. */
      if (!S.rang) S.rang = cale.rangConnu();
      renderWallet();
      rafraichirRang();
      showMenu();
    },
    me: (m) => {
      S.me = m.me; S.inventory = m.inventory || [];
      /* Le bandeau des capitaines depend de `games` et du capitaine porte : il
         se repeint avec la bourse, sinon un refus du serveur ou une partie de
         plus laisserait un cadenas perime a l'ecran. */
      renderWallet(); repeindreCapitaines(); refreshPanel(); renderBonusRack();
      /* La partie qui vient de finir a pu faire monter ou descendre : la
         position se redemande a chaque fiche, c'est le seul moment ou elle
         peut avoir change. */
      rafraichirRang();
    },
    /* Le serveur peut renvoyer la liste en cours de session (seuils modifies,
       nouveau capitaine) : on la prend, l'ecran suivant la lira. */
    captains: (m) => { if (Array.isArray(m.captains) && m.captains.length) S.captains = m.captains; },
    jetons: (m) => {
      cale.rangerJetons(m.jetons, m.regles);
      if (UI.showMenu && S.open && !S.state) showMenu();
    },
    /* ⛔ ON OUBLIE CE QUE LE SERVEUR A TRAITE, ACCEPTE OU REFUSE. Garder une
       partie refusee la ferait renvoyer a chaque connexion, indefiniment : un
       bouchon qui ne se resorbe jamais, pour une partie qui ne rapportera
       jamais rien. */
    horsligne: (m) => {
      const traites = (m.verdicts || []).map((v) => v.jeton);
      const reste = cale.oublierParties(traites);
      const gagnees = (m.verdicts || []).filter((v) => v.ok && v.credite);
      if (gagnees.length) {
        toast(t('offline.credite', { n: gagnees.length }), 'ok');
        S.succes = null; S.historique = null;
      }
      const refusees = (m.verdicts || []).filter((v) => !v.ok);
      if (refusees.length) toast(t('offline.refuse', { n: refusees.length }), 'warn');
      /* S'il en reste, on continue par petits paquets : c'est le serveur qui
         donne le rythme, pas le telephone. */
      if (reste) setTimeout(envoyerLesParties, 1200);
    },
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
      peindreBulles();
    },
    /**
     * Ce qui vient d'etre recupere.
     *
     * ⚠️ C'EST LA LISTE DU SERVEUR QUI FAIT FOI, PAS CE QU'ON AVAIT DEMANDE. Si
     * un autre appareil du meme compte a recolte une seconde plus tot, celle-ci
     * revient vide : on le dit, et on repeint — plutot que d'annoncer une
     * recompense qui n'est jamais arrivee.
     */
    reclame: (m) => {
      const recus = Array.isArray(m.recus) ? m.recus : [];
      if (!recus.length) {
        toast(t('suc.rien'), 'warn');
        if (S.panel === 'succes') refreshPanel();
        return;
      }
      if (Array.isArray(S.succes)) {
        const pris = new Set(recus);
        for (const s of S.succes) if (pris.has(s.identify)) s.reclame = true;
      }
      toast(t('suc.recolte', { or: nombre(m.or || 0), maudit: nombre(m.gagne || 0) }), 'ok');
      if (S.sfx) S.sfx.play('coin', 0.3);
      if (S.panel === 'succes') refreshPanel();
      peindreBulles();
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
      /* ⚠️ LE PONT DOIT DIRE QU'IL EST SEUL. Le bandeau « sans reseau » et le
         repli du bouton solo sont calcules AU RENDU : sans ce repeint, le joueur
         reste devant un menu qui a l'air normal, appuie sur « defier un
         joueur », et ne comprend pas pourquoi rien ne se passe. */
      if (!S.state && S.open) showMenu();
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
      <!-- ⛔ CET ECRAN ETAIT UN CUL-DE-SAC. Sans reseau, on ne pouvait QUE
           reessayer : dans un metro, l'application etait morte pendant vingt
           minutes alors que le jeu, lui, sait tres bien tourner tout seul. Si
           des parties hors ligne attendent dans la cale, on ouvre la porte. -->
      ${cale.jetons().length ? `<button class="dc-btn dc-btn-ghost" id="dc-sans-reseau"
        >${esc(t('offline.entrer', { n: cale.jetons().length }))}</button>` : ''}
    </div>`;
  const retry = $('#dc-retry');
  if (retry) retry.onclick = () => { arreterRelance(); connect(); };
  const sans = $('#dc-sans-reseau');
  if (sans) {
    sans.onclick = () => {
      /* ⚠️ ON NE COUPE PAS LA RELANCE. Elle continue en arriere-plan : quand le
         reseau revient, l'accueil arrive et l'ecran se remet a jour tout seul,
         sans que le joueur ait rien a faire. */
      if (!S.me) S.me = cale.moi();
      showMenu();
    };
  }

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
 * ⛔ CETTE FONCTION NE SERT PLUS A RETRECIR, ET C'EST VOULU. Le texte maigrissait
 * pour tenir ; le nombre s'abrege maintenant (voir `nombre`), donc il tient
 * toujours. On garde la classe pour le seul cas ou six caracteres se pressent —
 * « 999,9k » — ou un demi-point de moins evite que le dernier ne touche le bord.
 *
 * Ancienne raison d'etre, gardee pour memoire :
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
/**
 * Le montant tel qu'il tient sur sa plaque, quelle que soit la fortune.
 *
 * ⛔ LES PLAQUES NE CHANGENT PLUS DE TAILLE. Elles s'allongeaient avec le
 * nombre : la barre dansait a chaque fin de partie, et les trois plaques
 * n'etaient jamais alignees deux fois de suite. Une plaque est un objet
 * dessine, pas une boite de texte — c'est au NOMBRE de tenir dedans.
 *
 * ⚠️ D'OU L'ABREGE, ET SON SEUIL. En dessous de dix mille, on ecrit tout : ce
 * sont les montants qu'on lit vraiment, et « 9 999 » se comprend mieux que
 * « 10,0k ». Au-dela, on abrege — six caracteres au maximum, ce qui couvre
 * jusqu'a « 999M ». Un joueur qui depasse le milliard aura merite qu'on y
 * revienne.
 *
 * ⚠️ ET LE GROUPEMENT VIENT DU TELEPHONE. Un espace pose a la main serait juste
 * en francais et faux ailleurs : l'anglais met une virgule, l'arabe ses propres
 * chiffres.
 */
function nombre(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  const abrege = (x, suffixe) => {
    const dixiemes = Math.floor(x * 10) / 10;
    const texte = dixiemes >= 100 ? String(Math.floor(dixiemes))
      : String(dixiemes).replace('.', ',');
    return texte + suffixe;
  };
  if (v >= 1e9) return abrege(v / 1e9, 'G');
  if (v >= 1e6) return abrege(v / 1e6, 'M');
  if (v >= 1e4) return abrege(v / 1e3, 'k');
  try { return v.toLocaleString(); } catch (_) { return String(v); }
}

function tailleBourse(n) {
  return nombre(n).length >= 6 ? 'dc-coins-c5' : '';
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
  /* ⚠️ LES TROIS PLAQUES SONT DES IMAGES, PAS DES BOITES DESSINEES EN CSS. Elles
     portent leur piece, leurs rivets et leur usure : les refaire en degrades et
     en ombres aurait donne trois rectangles qui ressemblent au jeu sans en etre.
     Le texte se pose DEDANS ; c'est la seule chose que le CSS ajoute. */
  $('#dc-wallet').innerHTML = `
    <div class="dc-plaque dc-plaque-or ${tailleBourse(S.me.coins)}"
         title="${esc(t('hdr.coins'))}"><span>${nombre(S.me.coins)}</span></div>
    <!-- ⛔ LA BOURSE MAUDITE S'AFFICHE TOUJOURS, MEME A ZERO. Je l'avais masquee
         tant qu'elle etait vide, en pensant qu'un compteur a zero n'apprend
         rien. C'est l'inverse : une monnaie qu'on ne voit jamais est une
         monnaie qui n'existe pas. A zero, la plaque POSE LA QUESTION — le
         joueur cherche comment la remplir, et la reponse est dans les hauts
         faits. Et la barre ne change plus de forme au premier succes. -->
    <div class="dc-plaque dc-plaque-maudite ${tailleBourse(S.me.premium || 0)}"
         title="${esc(t('hdr.cursed'))}"><span>${nombre(S.me.premium || 0)}</span></div>
    <div class="dc-plaque dc-plaque-rang" title="${esc(t('menu.rang'))}">
      <span>${S.rang ? '#' + nombre(S.rang) : '—'}</span><em>${esc(t('menu.rangCourt'))}</em>
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

/** Ouvrir une page depuis l'exterieur — les reglages y envoient les regles. */
export function ouvrirPanneau(nom) {
  if (S.panel !== nom) togglePanel(nom);
}

function togglePanel(name) {
  const panel = $('#dc-panel');
  /* ⛔ L'ACCUEIL N'EST PAS UNE PAGE : C'EST LEUR ABSENCE. Le faire passer par la
     meme porte que les autres lui donnerait le comportement d'une bascule — un
     premier appui ouvrirait une page « accueil » qui n'existe pas, donc vide, et
     un second la refermerait. Un bouton d'accueil qui, une fois sur deux,
     n'accueille rien. Il RAMENE, toujours, et ne fait rien quand on y est
     deja. */
  if (name === 'accueil') {
    if (S.panel) {
      S.panel = null;
      panel.classList.remove('on');
      fermerLecteur();
      S.sfx.play('shut', 0.2);
    }
    marquerOnglets();
    return;
  }
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
  marquerOnglets();
}

/**
 * Allumer le bouton du lieu ou l'on est.
 *
 * ⚠️ ET L'ACCUEIL S'ALLUME QUAND AUCUNE PAGE N'EST OUVERTE. Sans cette ligne, le
 * medaillon du milieu serait le seul bouton de la barre a n'etre jamais allume :
 * on l'aurait lu comme desactive, alors qu'il designe l'endroit ou l'on se
 * trouve la plupart du temps.
 */
/**
 * Le medaillon du milieu roule ses des a l'appui.
 *
 * ⛔ UN APNG NE SE REJOUE PAS EN LE RE-AFFECTANT. Reposer la meme adresse dans
 * `src` ne relance rien : le navigateur reconnait l'URL, ressert l'image deja
 * decodee et la laisse sur sa derniere image — l'animation ne jouerait qu'une
 * fois, au premier appui de la partie. Il faut une adresse NEUVE. On alterne
 * entre deux, et deux seulement : une adresse differente a chaque fois relancerait
 * bien l'animation, mais ferait garder au cache une copie de 211 Ko par appui.
 *
 * ⚠️ ET ON REND LA MAIN AU DESSIN FIXE APRES LE MOUVEMENT, PAS APRES L'ANIMATION.
 * Elle dure 2,28 s dont 1,5 s ou elle affiche deja, immobile, le dessin au repos —
 * garder l'APNG a l'ecran pendant cette seconde et demie ne montrerait rien de
 * plus et retiendrait dix images decodees en memoire. Le relais est invisible :
 * la derniere image de l'animation EST le fichier au repos, au pixel pres.
 */
let relaisAccueil = 0;
let minuteurAccueil = 0;
function animerAccueil(bouton) {
  const img = bouton.querySelector('img');
  if (!img) return;
  /* Le minuteur vit ici et pas dans `dataset` : `dataset` ne garde que des
     chaines, et `clearTimeout('37')` n'annule rien du tout. Deux appuis
     rapproches auraient laisse le premier minuteur rendre la main au dessin
     fixe au milieu de la seconde animation. */
  clearTimeout(minuteurAccueil);
  relaisAccueil = 1 - relaisAccueil;
  img.src = `${ASSETS}img/slot_bas_home_anim.png?${relaisAccueil ? 'a' : 'b'}`;
  minuteurAccueil = setTimeout(() => {
    img.src = `${ASSETS}img/slot_bas_home.png`;
  }, 820);
}

/**
 * LA PLAQUE MONTRE LA POSITION, PLUS LES POINTS.
 *
 * ⚠️ ET LA POSITION NE VIENT PAS DU MEME ENDROIT QUE LE RESTE. Les pieces, les
 * points et les parties arrivent dans le message `me` de la socket : ce sont des
 * colonnes du joueur. Sa POSITION, elle, n'existe nulle part — elle se calcule
 * en classant toute la table, et seule la route du classement la produit. On la
 * demande donc apres chaque changement de fiche, et on la garde en cale : sans
 * memoire, la plaque afficherait un tiret a chaque ouverture le temps de la
 * requete, et pour toujours en mode hors ligne.
 *
 * ⚠️ UN ECHEC N'EFFACE RIEN. Un reseau qui tousse ne doit pas valoir « pas de
 * classement » : la plaque garde le dernier chiffre connu.
 */
async function rafraichirRang() {
  if (!S.net || typeof S.net.rest !== 'function') return;
  try {
    const recu = await S.net.rest('/api/leaderboard?limit=1');
    const rang = Math.round(Number(recu && recu.me && recu.me.rang) || 0);
    if (rang > 0 && rang !== S.rang) { S.rang = rang; cale.rangerRang(rang); renderWallet(); }
  } catch (_) { /* la plaque garde son dernier chiffre */ }
}

/**
 * LA BULLE DES HAUTS FAITS A RECUPERER.
 *
 * ⛔ ELLE NE PEUT PAS ATTENDRE QU'ON OUVRE LA PAGE. La liste etait demandee
 * paresseusement, a la premiere ouverture : la bulle serait donc restee vide
 * tant que le joueur n'aurait pas visite l'endroit qu'elle sert precisement a
 * lui faire visiter. On demande la liste des l'entree, une fois, pour quelques
 * centaines d'octets.
 *
 * ⚠️ ET ELLE COMPTE CE QUI EST DU, PAS CE QUI EST FAIT. « Quantite de succes
 * debloques » se lirait comme un palmares — un nombre qui monte et ne redescend
 * jamais, donc un badge permanent qu'on cesse de voir. Une bulle dit qu'il y a
 * quelque chose A FAIRE : elle disparait quand la recolte est finie.
 */
function peindreBulles() {
  const bouton = $('#dicewrap .dc-onglet[data-panel="succes"]');
  if (!bouton) return;
  /* `=== false` et non `!` : un serveur d'avant la recolte n'envoie pas ce
     champ, et `undefined` ferait compter TOUS les hauts faits gagnes. */
  const n = Array.isArray(S.succes)
    ? S.succes.filter((s) => s.gagne && s.reclame === false).length : 0;
  /* ⛔ ELLE NE S'APPELLE PAS `dc-bulle`, ET C'EST UNE LECON. Ce nom etait DEJA
     pris par la bulle de dialogue des parties — « La maree tourne. » — avec son
     fond, sa queue en `::after` et son animation d'entree. Le badge en heritait
     donc de tout : il arrivait a 72 % de sa taille, et la queue de la bulle de
     dialogue se dessinait au milieu, en losange dore sur fond rouge. Rien
     n'echouait ; c'etait simplement un autre objet. */
  let pastille = bouton.querySelector('.dc-pastille');
  if (!n) { if (pastille) pastille.remove(); return; }
  if (!pastille) {
    pastille = document.createElement('span');
    pastille.className = 'dc-pastille';
    bouton.appendChild(pastille);
  }
  pastille.textContent = n > 99 ? '99+' : String(n);
}

function marquerOnglets() {
  const coque = $('#dicewrap');
  coque.querySelectorAll('.dc-tab, .dc-onglet').forEach((b) => {
    const sien = b.dataset.panel === 'accueil' ? !S.panel : b.dataset.panel === S.panel;
    b.classList.toggle('on', sien);
  });
  /* La page est transparente pour que le fond de l'application soit continu :
     il faut donc effacer ce qu'elle recouvre, sans quoi on lirait le menu au
     travers. La marque est posee sur la coque parce que les ecrans et la page
     sont des freres — aucun ne peut atteindre l'autre par un selecteur. */
  coque.classList.toggle('dc-en-page', !!S.panel);
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

/**
 * Renvoyer les parties jouees hors ligne, CINQ A LA FOIS.
 *
 * ⛔ PAS TOUT D'UN COUP. Vingt parties arrivees ensemble, c'est vingt rejeux et
 * vingt transactions cote serveur, pendant que d'autres joueurs attendent leur
 * tour de de. Le serveur en prend cinq, rend la main, et redemande la suite :
 * le bouchon ne se forme jamais parce qu'on ne le laisse pas se former.
 */
export function envoyerLesParties() {
  if (!S.net || !S.net.ready) return;
  const attente = cale.enAttente();
  if (!attente.length) return;
  S.net.send({ t: 'horsligne', parties: attente.slice(0, 5).map((p) => ({ jeton: p.jeton, journal: p.journal })) });
}

/**
 * Lancer une partie contre la machine SANS reseau.
 *
 * ⚠️ LE VRAI RESEAU EST MIS DE COTE, PAS COUPE. On garde `S.net` sous le coude :
 * a la fin de la partie, la connexion peut etre revenue, et il serait absurde de
 * la refaire.
 */
export function jouerHorsLigne() {
  const jeton = cale.prendreUnJeton();
  if (!jeton) { toast(t('offline.plusDeJetons'), 'warn'); return false; }

  const vrai = S.net;
  const poche = ouvrirPartieHorsLigne({
    jeton: jeton.id,
    graine: jeton.graine,
    moi: 0,
    capitaines: [(S.me && S.me.captain) || 'read', 'teach'],
    parures: [{ skin: S.me && S.me.skin, motif: S.me && S.me.motif }, null],
    noms: [(S.me && S.me.name) || '', 'IA'],
    regles: cale.reglesHorsLigne(),
  }, {
    match: (m) => { resetLobby(); onMatch(m); },
    state: onState,
    over: (m) => {
      /* La partie est finie : on la range pour le retour du reseau, PUIS on
         rend la main au vrai serveur. */
      cale.garderPartie(jeton.id, poche.partie.auJournal());
      S.net = vrai;
      onOver(m);
      envoyerLesParties();
    },
    idle: () => { S.net = vrai; S.state = null; S.seat = -1; showMenu(); },
    error: (m) => toast(messageServeur(m.msg), 'warn'),
  });
  S.net = poche;
  return true;
}

/* ───────────────────────────────────────────────────────────────── wiring ── */

export function initDice() {
  UI.showMenu = showMenu;
  /* Le pont declenche la partie hors ligne : c'est lui qui porte le bouton, et
     il n'a pas a connaitre le faux serveur. */
  UI.jouerHorsLigne = jouerHorsLigne;
  /* Le panneau lateral se repeint depuis l'arene : elle sait quand la partie
     commence, ce que la boutique ne peut pas deviner toute seule. */
  UI.refreshPanel = refreshPanel;
  UI.leaveMatch = () => { S.state = null; S.seat = -1; showMenu(); };
  UI.renderWallet = renderWallet;
  UI.requestClose = requestClose;
}
