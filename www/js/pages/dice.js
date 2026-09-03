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
/* ⛔ `diceStatus` N'EST PLUS IMPORTE. Il sondait l'adresse du service pour
   l'afficher dans l'ecran d'echec — « Essaye http://192.168.1.19:8100 » — et cet
   ecran n'existe plus. La fonction reste dans dice_net.js : l'atelier de
   developpement s'en sert, le jeu non. */
import { DiceNet } from './dice_net.js';
import { Sfx } from './dice_board.js';
import { Musique } from '../ui/musique.js';
import { facteur, surVolume, volumes, reglerVolume, DEFAUT } from '../ui/volumes.js';
import { niveauCanal } from '../ui/bus_audio.js';
import { S, UI, ASSETS, PIECE_MAUDITE, screen, bonusArt, preloadAssets,
         envoyerCoup } from './dice_state.js';
import { onMatch, onState, renderBonusRack, oublierEtat } from './dice_match.js';
import { onOver } from './dice_end.js';
import { ouvrirRegles, renderShop, renderRanking, renderSucces, renderCampagne } from './dice_panels.js';
import { renderReplays, ouvrirRejeu, fermerLecteur } from './dice_replay.js';
import { ouvrirPartieHorsLigne } from './dice_solo.js';
import * as cale from './dice_cale.js';
import { renderMenu, onRoom, onRoomFail, resetLobby, repeindreCapitaines,
         reprendreLienEnAttente, peindreReseau } from './dice_lobby.js';

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
/* ⚠️ `art` NOMME UNE PAIRE, PAS UN FICHIER. Chaque onglet a son dessin au repos
   (`<art>.png`) et son animation (`<art>_anim.png`), et les deux sont le MEME
   dessin a leurs extremites : la derniere image de l'animation EST le fichier
   fixe, au pixel pres, et la premiere lui est identique. C'est ce qui permet de
   passer de l'un a l'autre a l'appui sans que le bouton saute. */
const ONGLETS = [
  { id: 'shop', cle: 'tab.shop', art: 'bas_shop', cote: 'g' },
  { id: 'ranking', cle: 'tab.ranking', art: 'bas_rank', cote: 'g' },
  { id: 'accueil', cle: 'nav.accueil', art: 'slot_bas_home', cote: 'home' },
  { id: 'succes', cle: 'tab.succes', art: 'bas_succes', cote: 'd' },
  { id: 'replay', cle: 'tab.replay', court: 'nav.replay', art: 'bas_replay', cote: 'd' },
];

/* ⛔ QUATRE PAGES SUR CINQ N'ONT RIEN A MONTRER SANS SERVEUR, ET ELLES LE
   DISAIENT APRES COUP. La boutique attend le catalogue, le classement une route
   HTTP, les hauts faits leur liste, le journal l'historique : sans reseau, on
   ouvrait une page vide ou un message d'erreur. « Si le serveur ou internet est
   down on grisatre aussi les liens dans la navbar pour eviter d'avoir des alert
   d'erreur inutilement. »
   L'accueil n'y figure pas : c'est le jeu lui-meme, il ne depend de personne. */
const ONGLETS_RESEAU = ['shop', 'ranking', 'succes', 'replay'];

/**
 * Eteindre les onglets qui demandent quelqu'un au bout du fil.
 *
 * ⚠️ ILS RESTENT CLIQUABLES, ET C'EST DELIBERE. Sur telephone il n'y a pas de
 * survol, donc pas d'infobulle : un bouton `disabled` ne dit ni son nom ni son
 * motif. Celui-ci repond — et ce qu'il repond EST la raison. C'est la meme regle
 * que pour les jetons d'effet du ratelier.
 */
function peindreOnglets() {
  const horsLigne = !S.net || !S.net.ready;
  document.querySelectorAll('#dicewrap .dc-onglet[data-panel]').forEach((b) => {
    b.classList.toggle('dc-onglet-eteint',
                       horsLigne && ONGLETS_RESEAU.includes(b.dataset.panel));
  });
}

function shellMarkup() {
  return `
  <!-- ⛔ POURQUOI UN FILTRE SVG ET PAS QUATRE OMBRES PORTEES. Un contour blanc
       fait d'ombres portees suit l'alpha TEL QUEL — et ces dessins portent un
       halo largement semi-transparent : 46 % des pixels du parchemin et 60 %
       de ceux de la carte sont a une opacite intermediaire. Une ombre portee
       sur du demi-transparent rend du demi-blanc : on obtenait une lueur floue
       autour de l'objet au lieu d'un trait, et le liseré ne suivait plus la
       forme.

       Ce filtre DURCIT l'alpha avant de l'epaissir : feFuncA discrete ramene
       chaque pixel a dedans ou dehors, feMorphology dilate cette silhouette
       nette, et le blanc n'est verse que dedans. Le trait suit alors le ruban,
       le sceau, la fleche et les dents du papier — comme sur la croix. -->
  <svg width="0" height="0" aria-hidden="true" focusable="false"
       style="position:absolute;pointer-events:none">
    <filter id="pd-cerne" x="-25%" y="-25%" width="150%" height="150%"
            color-interpolation-filters="sRGB">
      <feComponentTransfer in="SourceAlpha" result="dur">
        <feFuncA type="discrete" tableValues="0 1"></feFuncA>
      </feComponentTransfer>
      <!-- ⚠️ UN FLOU PUIS UN SEUIL, PAS feMorphology. La dilatation de
           feMorphology se fait avec un noyau CARRE : les angles du trait
           ressortaient droits, et sur la carte des conditions le contour
           s'equerrait au lieu de suivre le papier. Un flou gaussien s'etend en
           rond ; le seuil qui suit le retaille en trait franc. Meme epaisseur,
           coins arrondis. -->
      <feGaussianBlur in="dur" stdDeviation="2" result="flou"></feGaussianBlur>
      <feComponentTransfer in="flou" result="gros">
        <feFuncA type="linear" slope="14" intercept="-1.4"></feFuncA>
      </feComponentTransfer>
      <feFlood flood-color="#FFFFFF" result="blanc"></feFlood>
      <feComposite in="blanc" in2="gros" operator="in" result="cerne"></feComposite>
      <feMerge>
        <feMergeNode in="cerne"></feMergeNode>
        <feMergeNode in="SourceGraphic"></feMergeNode>
      </feMerge>
    </filter>
    <!-- Le meme trait, a l'epaisseur du lisere des boutons : les dessins du
         pont sont deux fois plus grands que les icones des reglages, et un
         contour calcule pour 46 px y paraitrait un cheveu. -->
    <filter id="pd-cerne-gros" x="-25%" y="-25%" width="150%" height="150%"
            color-interpolation-filters="sRGB">
      <feComponentTransfer in="SourceAlpha" result="dur">
        <feFuncA type="discrete" tableValues="0 1"></feFuncA>
      </feComponentTransfer>
      <feGaussianBlur in="dur" stdDeviation="2.7" result="flou"></feGaussianBlur>
      <feComponentTransfer in="flou" result="gros">
        <feFuncA type="linear" slope="14" intercept="-1.4"></feFuncA>
      </feComponentTransfer>
      <feFlood flood-color="#FFFFFF" result="blanc"></feFlood>
      <feComposite in="blanc" in2="gros" operator="in" result="cerne"></feComposite>
      <feMerge>
        <feMergeNode in="cerne"></feMergeNode>
        <feMergeNode in="SourceGraphic"></feMergeNode>
      </feMerge>
    </filter>
  </svg>
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
    <nav class="dc-bas pd-panel" id="dc-bas">${ONGLETS.map((o) => `
      <button class="dc-onglet dc-onglet-${o.cote}" data-panel="${o.id}" data-art="${o.art}"
              title="${esc(t(o.cle))}" aria-label="${esc(t(o.cle))}"
      ><img src="${ASSETS}img/${o.art}.png" alt=""></button>`).join('')}
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
      /* Eteint : on anime quand meme — le geste a ete percu — mais on dit
         pourquoi au lieu d'ouvrir une page qui n'aurait rien a montrer. */
      if (b.classList.contains('dc-onglet-eteint')) {
        animerOnglet(b);
        toast(t('offline.besoinReseau'), 'warn');
        return;
      }
      animerOnglet(b);
      togglePanel(b.dataset.panel);
    };
  });
  /* Au premier affichage aucune page n'est ouverte : c'est l'accueil qui est
     allume, et il doit le montrer avant qu'on ait touche quoi que ce soit. */
  marquerOnglets();
  peindreOnglets();

  document.addEventListener('keydown', onKey, true);
  document.addEventListener('fullscreenchange', syncFull);
  S.built = true;
}

/* ────────────────────────────────────────────────────────── open / close ── */

/* Le reseau revient, ou l'application repasse au premier plan : ce sont les deux
   instants ou une tentative aboutit. On ne les laisse pas passer. */
/**
 * ⛔ ET CE RACCOURCI NE SERVAIT JAMAIS AU MOMENT OU IL COMPTE. Les deux
 * ecouteurs etaient gardes par `!S.net` — or `connect()` pose `S.net` AVANT
 * d'attendre la socket. Pendant les secondes ou une tentative est en vol,
 * `S.net` n'est donc pas nul, et l'evenement qui annonce le retour du reseau
 * etait ignore : on continuait d'attendre la garde d'une tentative partie quand
 * il n'y avait pas de reseau, au lieu d'en lancer une qui aboutirait.
 *
 * C'est exactement l'instant qu'il ne faut pas manquer quand une table nous
 * attend : on abandonne la tentative morte et on recommence tout de suite.
 */
function reveiller() {
  if (!S.open) return;
  if (!S.net) { arreterRelance(); connect(); return; }
  /* Une partie de poche tient `S.net` : c'est elle qui joue, on ne touche pas. */
  if (S.poche) return;
  /* ⛔ « OPEN » NE PROUVE PLUS RIEN AU REVEIL. On lisait `ready` (readyState
     OPEN) et on repartait content — or c'est exactement l'etat d'une socket a
     demi-morte apres une veille : le proxy a lache, plus rien ne passe, mais le
     readyState ment. Le joueur restait « sans reseau » jusqu'a relancer l'appli.
     On interroge donc `vivant` — OPEN ET un mot du serveur dans la derniere
     fenetre de silence : si la liaison est fraiche, on ne fait rien (aucun
     paquet inutile) ; sinon, en partie OU hors partie, on la remplace tout de
     suite. C'est le moment ou une tentative aboutit, et le seul cout est UNE
     reconnexion, pile quand elle est utile. */
  if (S.net.vivant || S.net.enCours) return;
  /* Douteuse : on la termine soi-meme et on repart de zero. `close()` marque
     `closedByUs`, donc le gestionnaire `closed` ne reprogrammera rien — c'est
     nous qui reprenons la main, ici, sans attendre les 18 s du ping. */
  try { S.net.close(); } catch (_) { /* deja morte */ }
  S.net = null;
  arreterRelance();
  connect();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', reveiller);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reveiller();
  });
  /* ⛔ `visibilitychange` NE SUFFIT PAS SUR IOS. Le WKWebView de la coque ne le
     tire pas toujours au sortir de veille — mais `pageshow` et `focus`, si. Les
     trois pointent vers le meme reveil, qui ne fait rien quand la liaison est
     deja fraiche : les cumuler ne coute donc rien et ferme les cas ou l'un
     manque a l'appel. (Le battement du ping reste le dernier filet : au premier
     tic apres le reveil, un `vu` perime declenche la reprise de lui-meme.) */
  window.addEventListener('pageshow', reveiller);
  window.addEventListener('focus', reveiller);
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
  /* ⛔ UNE PARTIE HORS LIGNE TIENT `S.net`, ET LA RELANCE LA REMPLACAIT.
     `jouerHorsLigne()` pose un faux serveur de poche dans `S.net` et garde le
     vrai de cote ; `connect()`, lui, ecrasait ce faux serveur par une socket
     neuve des que le reseau revenait. Tout ce que le plateau envoyait ensuite
     — un lancer, une pose, un effet — partait vers le serveur au lieu de la
     partie en cours, qui se figeait au milieu d'un tour sans un mot.
     « S'il joue en mode hors ligne il faut pas le deranger et le laisser
     finir. » On repasse plus tard : la table d'abord. */
  if (S.poche) { relancerPlusTard(); return; }

  /* ⛔ CETTE ROUE RECOUVRAIT TOUT, A CHAQUE TENTATIVE. `connectFailed` prend
     bien soin de ne pas deranger le joueur — mais la RELANCE repasse par ici, et
     `screen('connect')` repeignait la roue par-dessus ce qu'il regardait.
     Deux mesures, deux pannes :
       — sans serveur, le pont s'affichait 448 ms puis disparaissait pour
         toujours derriere « On monte a bord… » : le mode hors ligne, celui-la
         meme qui doit marcher sans serveur, etait inatteignable ;
       — une coupure en pleine partie remplacait le plateau par la meme roue
         pendant les trente secondes de la fenetre de reprise, sans un mot.
     « Il faut pas que ca recharge a chaque detection du serveur : tout ce qui
     est cote serveur doit etre en background, et l'affichage ne change que la ou
     il doit changer. » La roue n'a donc qu'un seul moment legitime — le tout
     premier lancement, quand il n'y a encore rien a montrer. Ensuite on se
     reconnecte en silence, et c'est le bandeau du pont qui parle. */
  const rienALEcran = !document.querySelector('#dicewrap .dc-screen.on')
    || !!document.querySelector('#dc-screen-connect.on');
  if (rienALEcran) {
    screen('connect');
    $('#dc-screen-connect').innerHTML =
      '<div class="dc-connect"><img class="dc-wheel" src="' + ASSETS + 'img/icon_loader.png" alt="">'
      + '<p>' + esc(t('connect.boarding')) + '</p></div>';
  }

  const net = new DiceNet({
    welcome: (m) => {
      /* On est passe : l'attente repart de zero pour la prochaine coupure. */
      arreterRelance();
      S.me = m.me; S.inventory = m.inventory || []; S.shop = m.shop || [];
      S.rules = m.rules || S.rules;
      if (Array.isArray(m.captains) && m.captains.length) S.captains = m.captains;
      S.campCaps = Array.isArray(m.campCaps) ? m.campCaps : (S.campCaps || []);
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
      /* ⛔ ON NE RAMENE PAS AU PONT QUELQU'UN QUI JOUE. Le serveur revient
         pendant une partie hors ligne — c'est meme le cas le plus courant,
         puisque la relance tourne en fond pendant qu'il joue — et `showMenu()`
         lui retirait sa table au milieu d'un tour. Le pont se repeint quand il y
         revient de lui-meme, et `renderMenu` relit l'etat du reseau A CE
         MOMENT-LA : ses boutons seront dores, ce qui est exactement ce qu'on
         veut lui montrer. */
      /* ⛔ ET ON NE REFAIT PAS LE PONT POUR TROIS BOUTONS. `showMenu()` le
         reconstruit entierement : a chaque reconnexion — donc potentiellement
         toutes les quinze secondes — l'ecran clignotait et la fiche du capitaine
         se refermait. `peindreReseau()` ne touche que ce qui a change ; il rend
         `false` quand le pont n'existe pas encore, et c'est le seul cas ou l'on
         dessine pour de bon. Le bandeau des capitaines, lui, peut avoir change :
         la liste vient d'arriver, avec ses seuils. */
      if (S.state && S.state.phase !== 'over') { /* il joue : on ne derange pas */ }
      else if (peindreReseau()) { repeindreCapitaines(); }
      else showMenu();
      peindreOnglets();
      /* Une invitation touchee alors que le jeu etait ferme attend ici. */
      reprendreLienEnAttente();
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
    /* La carte de la campagne : demandee a l'ouverture de la page, repeinte
       des qu'elle arrive. */
    campagne: (m) => {
      S.campagne = m;
      if (Array.isArray(m.capitaines)) S.campCaps = m.capitaines;
      if (S.panel === 'campagne') { refreshPanel(); renderWallet(); }
    },
    /* Le verdict d'un niveau : les etoiles nouvelles paient, le pont peut
       avoir un capitaine de plus a deverrouiller. */
    'campagne.resultat': (m) => {
      if (Array.isArray(m.capitaines) && m.capitaines.length) {
        const avant = (S.campCaps || []).length;
        S.campCaps = m.capitaines;
        if (m.capitaines.length > avant) toast(t('camp.capitaine'), 'ok');
      }
      S.campagne = null;             /* la carte se relira avec les etoiles a jour */
      const n = (m.neuves & 1 ? 1 : 0) + (m.neuves & 2 ? 1 : 0) + (m.neuves & 4 ? 1 : 0);
      if (n > 0) toast(t('camp.resultat', { n, or: m.or }), 'ok');
      repeindreCapitaines();
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
    match: (m) => {
      /* Le niveau de campagne en cours, ou null : l'ecran de fin s'en sert
         pour que « Rejouer » relance LE NIVEAU. */
      S.campagneEnCours = m.campagne || null;
      /* ⛔ LA TABLE S'OUVRE, LA PAGE SE RANGE. Une partie lancee depuis la
         carte de la Piraterie laissait le panneau des paliers ouvert PAR-DESSUS
         l'arene — « j'ai encore le menu du choix du niveau au lieu de la
         partie ». Ce que le pont fait tout seul (il n'est pas une page), la
         page doit le faire ici. */
      if (S.panel) togglePanel('accueil');
      resetLobby(); onMatch(m);
    },
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
      /* ⛔ « VOUS N'ETES DANS AUCUNE PARTIE », ECRIT PAR-DESSUS UNE PARTIE.
         Vu a l'ecran : l'arene affichee, deux plateaux vides, un score de 8 sur
         une grille sans un seul de, et ce refus en travers. C'est un etat
         FANTOME — le client garde le dernier instantane qu'il a recu, le serveur
         a perdu la table. Un redemarrage du service suffit : les parties vivent
         en memoire, elles ne survivent pas au processus. Le joueur restait alors
         devant un plateau mort, chaque geste rendant le meme refus.
         Le serveur vient de dire qu'il n'y a plus de table : on le CROIT, on
         range l'arene et on revient au pont. */
      if (m.msg === 'you are not in a match' && S.state) {
        S.state = null;
        S.seat = -1;
        S.queued = false;
        oublierEtat();
        toast(messageServeur(m.msg), 'warn');
        showMenu();
        return;
      }
      toast(messageServeur(m.msg), 'warn');
      rendreLaMain();
      /* `refresh` est le message qui existe : il renvoie un `me` frais, et
         c'est `me` qui repeint le pont. Il n'y a pas de message `me` entrant —
         l'inventer aurait produit un refus « unknown message » par-dessus le
         premier refus. */
      if (m.msg === 'captain locked' && S.net) S.net.send({ t: 'refresh' });
    },
    /* Un jeton refuse est une panne comme une autre DU POINT DE VUE DU JOUEUR :
       il n'y peut rien, et le diagnostic ne lui apprendrait rien. On entre sans
       reseau, et la relance retentera avec un jeton frais. */
    denied: () => connectFailed(),
    closed: (byUs) => {
      /* ⚠️ `S.net` DOIT TOMBER AVEC LA CONNEXION. La relance automatique et les
         panneaux verifient sa presence pour savoir s'ils peuvent parler : le
         laisser en place derriere une socket morte, c'est promettre un canal
         qui n'existe plus. */
      if (byUs) return;
      /* ⚠️ MAIS SEULEMENT SI C'EST ENCORE LA NOTRE. Une socket abandonnee peut
         rendre son `close` longtemps apres qu'une liaison neuve l'a remplacee :
         effacer `S.net` a ce moment-la jetterait celle qui marche. */
      if (S.net !== net) return;
      S.net = null;
      if (!S.open) return;
      /* ⚠️ LE PONT DOIT DIRE QU'IL EST SEUL. Le bandeau « sans reseau » et le
         repli du bouton solo sont calcules AU RENDU : sans ce repeint, le joueur
         reste devant un menu qui a l'air normal, appuie sur « defier un
         joueur », et ne comprend pas pourquoi rien ne se passe. */
      if (!S.state && S.open && !peindreReseau()) showMenu();
      peindreOnglets();
      /* ⛔ ON NE MONTRE PLUS LA PAGE D'ECHEC AU PREMIER SOUFFLE. « Je ferme mon
         telephone, je le rouvre, et j'ai une page qui me dit serveur
         indisponible » : la socket ne survit pas a la mise en veille, c'est
         normal — ce qui ne l'est pas, c'est de traiter ce reveil comme une
         panne. On se rebranche en silence ; l'ecran d'echec n'apparait que si
         plusieurs tentatives echouent vraiment. */
      relancerPlusTard();
    },
  });
  S.net = net;

  /* ⚠️ UNE TENTATIVE ABANDONNEE NE PARLE PLUS AU NOM DU JEU. `reveiller()` peut
     jeter celle-ci pour en lancer une meilleure pendant qu'on attend ici : son
     echec arriverait alors APRES, et reprogrammerait une relance par-dessus la
     tentative en cours. On ne conclut que si l'on est encore la tentative
     courante. */
  /* En partie, la garde est courte : mieux vaut six tentatives dans la fenetre
     de reprise qu'une seule attente de huit secondes (voir RELANCE_PARTIE). */
  try { await net.connect(enPartie() ? { garde: GARDE_PARTIE } : undefined); }
  catch (_) { if (S.net === net) connectFailed(); }
}



/* Rouvrir ce qu'un envoi avait ferme par avance.
   ⚠️ ELLE EST VIDE, ET C'EST VOULU. Son seul client etait le bouton de mise, qui
   se desactivait a l'envoi et restait mort quand le serveur refusait — la partie
   paraissait figee. La mise n'existe plus, mais la lecon reste : tout bouton qui
   se ferme en attendant une reponse doit se rouvrir ici, et le gestionnaire
   d'erreur l'appelle deja. La garder vide coute une ligne ; la supprimer coute
   de reapprendre le defaut. */
function rendreLaMain() {}

/**
 * LE SERVEUR NE REPOND PAS. LE JOUEUR N'A PAS A L'APPRENDRE AINSI.
 *
 * ⛔ CET ECRAN ETAIT UN ECRAN DE DEVELOPPEUR MONTRE A UN JOUEUR, et il livrait
 * trois choses dont aucune ne le regarde :
 *
 *   « cannot reach the game server at http://192.168.1.19:8100 »
 *   « Essaye http://192.168.1.19:8100 — Load failed »
 *   « Relancez-le avec python dice_server/deploy/deploy.py (--logs lit son
 *     journal). »
 *
 * Une adresse de reseau LOCAL, un message d'erreur de moteur, et une commande a
 * taper dans un terminal qu'il n'a pas. « Depuis quand un joueur voit
 * 192.168.1.19 ? » Il n'aurait jamais du : ces lignes ont ete ecrites pour un
 * poste de developpement et n'ont jamais ete retirees du chemin du joueur.
 *
 * ⛔ ET C'ETAIT AUSSI UN CUL-DE-SAC DEGUISE EN CHOIX. Deux boutons — reessayer,
 * ou entrer sans reseau — pour une decision qui n'en est pas une : le jeu tourne
 * sans reseau, c'est tout le mode hors ligne, et personne ne prefere lire un
 * diagnostic. On ENTRE, simplement. Le pont s'ouvre, les deux boutons qui
 * demandent quelqu'un en face sont grises, un bandeau dit « sans reseau ». La
 * relance continue en silence derriere ; quand le serveur revient, le pont se
 * repeint et les boutons redeviennent dores.
 *
 * Cette fonction ne prend plus de message : il n'y a plus rien a afficher.
 */
function connectFailed() {
  /* ⛔ ON NE DERANGE PAS UNE PARTIE EN COURS. « S'il joue en mode hors ligne il
     faut pas le deranger et le laisser finir. » Repeindre le pont par-dessus une
     table qui se joue, c'est lui retirer sa partie des mains au milieu d'un
     tour — et hors ligne il n'a meme pas de serveur pour la lui rendre. */
  if (!S.open || (S.state && S.state.phase !== 'over')) { relancerPlusTard(); return; }
  /* Sans reseau, l'identite vient de la cale : c'est elle qui porte le nom, la
     bourse et le capitaine de la derniere session. */
  if (!S.me) S.me = cale.moi();
  /* Meme regle qu'au retour du reseau : on repeint ce qui a change, et on ne
     dessine le pont en entier que s'il n'existe pas encore. */
  if (!peindreReseau()) showMenu();
  peindreOnglets();
  /* ⚠️ ET LA RELANCE CONTINUE. Un ascenseur, un tunnel, un changement de wifi :
     la connexion revient d'elle-meme, et le joueur n'a rien a faire pour cela.
     L'attente double a chaque echec (1, 2, 4… jusqu'a 15 s) : marteler un
     serveur qui redemarre le ralentit et vide la batterie pour rien. */
  relancerPlusTard();
}

const RELANCE_MIN = 1000;
const RELANCE_MAX = 15000;
let relanceDelai = RELANCE_MIN;
let relanceTimer = 0;

/* ⛔ LE BACKOFF FAISAIT PERDRE DES PARTIES, ET DES POINTS DE CLASSEMENT.
   Signale en production : « apres un lance de des un joueur a ete ejecte du
   serveur et n'a pas pu la reprendre et a perdu des points de classement. »

   Ce n'est pas une panne du serveur, c'est une COURSE, et le telephone la
   perdait. Le serveur garde la table de cote pendant `DICE_RESUME_MS` puis
   declare forfait — et un forfait par deconnexion deplace bien l'Elo (c'est
   voulu : sans cela, couper son reseau serait la sortie gratuite d'une partie
   perdue). En face, la relance doublait son attente a chaque echec, une seule
   tentative en vol, et chaque tentative pouvait couter jusqu'a quatorze
   secondes (six pour le jeton, huit pour la garde de la socket) :

     t=0     coupure
     t=1s    tentative 1  ── echoue au pire a t=15s
     t=17s   tentative 2  ── echoue au pire a t=31s
     t=30s   le serveur a deja declare forfait

   DEUX tentatives ratees suffisaient a bruler la fenetre. L'attente qui double
   a tout son sens devant un serveur eteint — marteler le ralentit et vide la
   batterie — mais elle n'en a AUCUN quand une table nous attend et qu'un
   chronometre tourne dessus. En partie, on frappe donc a cadence fixe et avec
   une garde courte, pour depenser la fenetre en TENTATIVES plutot qu'en
   attente. */
const RELANCE_PARTIE = 500;
const GARDE_PARTIE = 4000;

/** Une table nous attend-elle a l'autre bout ? La cadence en depend. */
function enPartie() {
  return !!(S.state && S.state.phase !== 'over' && !S.poche);
}

/* ⛔ `RELANCE_MUETTE` A DISPARU AVEC L'ECRAN D'ECHEC. Elle comptait les
   tentatives silencieuses avant de MONTRER la panne : au quatrieme essai, le
   joueur recevait le diagnostic en pleine figure. Il n'y a plus rien a montrer,
   donc plus rien a compter — toutes les tentatives sont muettes, et la seule
   chose qui change a l'ecran est le bandeau « sans reseau » du pont. */

function arreterRelance() {
  if (relanceTimer) { clearTimeout(relanceTimer); relanceTimer = 0; }
  relanceDelai = RELANCE_MIN;
}

function relancerPlusTard() {
  if (relanceTimer) return;                     // une seule tentative en vol
  /* En partie, la cadence est fixe et courte : voir RELANCE_PARTIE. L'attente
     qui double reste la regle partout ailleurs. */
  const pressee = enPartie();
  const dans = pressee ? RELANCE_PARTIE : relanceDelai;
  if (!pressee) relanceDelai = Math.min(RELANCE_MAX, relanceDelai * 2);
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
    if (S.state.dice[S.seat] === null) { ev.preventDefault(); envoyerCoup({ t: 'roll' }); }
    return;
  }
  if (['1', '2', '3', '4'].includes(ev.key) && S.state.dice[S.seat] !== null) {
    ev.preventDefault();
    envoyerCoup({ t: 'place', column: parseInt(ev.key, 10) - 1 });
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
/* Le palier ou l'on se bat : le plus haut dont un niveau est ouvert. */
function palierCourant(niveaux) {
  let p = 1;
  for (const n of niveaux) if (n.ouvert && n.palier > p) p = n.palier;
  return p;
}
function etoilesPalier(niveaux, p) {
  return niveaux.filter((n) => n.palier === p)
    .reduce((t, n) => t + (n.etoiles & 1 ? 1 : 0) + (n.etoiles & 2 ? 1 : 0) + (n.etoiles & 4 ? 1 : 0), 0);
}
function capitaineDuPalier(niveaux, p) {
  const boss = niveaux.find((n) => n.palier === p && n.boss);
  return boss ? boss.capitaine : null;
}

let deroulantCampagne = null;
function fermerDeroulantCampagne() {
  if (deroulantCampagne) { deroulantCampagne.remove(); deroulantCampagne = null; }
}

function renderWalletCampagne() {
  const w = $('#dc-wallet');
  const niveaux = (S.campagne && S.campagne.niveaux) || [];
  if (!niveaux.length) {
    /* Pas encore recu la carte : on montre un chargement sobre, pas la bourse. */
    w.innerHTML = '<div class="dc-plaque dc-plaque-camp"><span>' + esc(t('camp.titre')) + '</span></div>';
    if (S.net) S.net.send({ t: 'campagne' });
    return;
  }
  const p = palierCourant(niveaux);
  const cap = capitaineDuPalier(niveaux, p);
  const nom = cap ? t('cap.' + cap + '.name') : '';
  const etoiles = etoilesPalier(niveaux, p);
  w.innerHTML = `
    <button class="dc-camp-hud" data-camp-hud>
      ${cap ? `<img src="${ASSETS}img/cap_${esc(cap)}.png" alt="">` : ''}
      <span class="dc-camp-hud-txt">
        <b>${esc(t('camp.palier', { n: p }))}</b>
        <em>${esc(nom)}</em>
      </span>
      <span class="dc-camp-hud-etoiles">\u2b50 ${etoiles}/15</span>
      <span class="dc-camp-hud-fleche">\u25be</span>
    </button>`;
  w.querySelector('[data-camp-hud]').onclick = (ev) => {
    ev.stopPropagation();
    basculerDeroulantCampagne(niveaux, ev.currentTarget);
  };
}

/* Le menu deroulant : les quinze paliers, leur capitaine (grise tant qu'il
   n'est pas gagne) et leur compte d'etoiles. C'est la carte des deblocages, en
   petit, depuis le bandeau. */
function basculerDeroulantCampagne(niveaux, ancre) {
  if (deroulantCampagne) { fermerDeroulantCampagne(); return; }
  const dejaGagnes = S.campCaps || [];
  const paliers = [];
  for (let p = 1; p <= 15; p++) {
    const cap = capitaineDuPalier(niveaux, p);
    if (!cap) continue;
    paliers.push({ p, cap, etoiles: etoilesPalier(niveaux, p), gagne: dejaGagnes.includes(cap) });
  }
  const d = document.createElement('div');
  d.className = 'dc-camp-drop';
  d.innerHTML = paliers.map((x) => `
    <div class="dc-camp-drop-l${x.etoiles >= 15 ? ' dc-camp-drop-plein' : ''}">
      <img src="${ASSETS}img/cap_${esc(x.cap)}.png" alt="" class="${x.gagne ? '' : 'dc-camp-gris'}">
      <span><b>${esc(t('camp.palier', { n: x.p }))}</b><em>${esc(t('cap.' + x.cap + '.name'))}</em></span>
      <i>\u2b50 ${x.etoiles}/15</i>
    </div>`).join('');
  ($('#dicewrap') || document.body).appendChild(d);
  const r = ancre.getBoundingClientRect();
  d.style.left = Math.max(8, Math.min(window.innerWidth - d.offsetWidth - 8, r.left)) + 'px';
  d.style.top = (r.bottom + 6) + 'px';
  deroulantCampagne = d;
  /* Un clic ailleurs referme. En capture, pour passer avant le reste. */
  setTimeout(() => {
    const fermer = (ev) => {
      if (deroulantCampagne && !deroulantCampagne.contains(ev.target)) {
        fermerDeroulantCampagne();
        document.removeEventListener('pointerdown', fermer, true);
      }
    };
    document.addEventListener('pointerdown', fermer, true);
  }, 0);
}

function renderWallet() {
  /* ⛔ SANS RESEAU, LA BARRE DU HAUT SE VIDAIT — OR ELLE SAIT. `S.me` n'arrive
     qu'avec le message d'accueil : tant qu'il n'est pas venu, cette fonction
     sortait a la premiere ligne et les trois plaques disparaissaient. Le joueur
     ouvrait le jeu dans le metro et voyait une barre nue, comme si sa bourse
     avait ete remise a zero.

     La cale garde pourtant la derniere fiche connue — c'est elle qui habille
     deja le mode hors ligne (`cale.moi()`, voir dice_cale.js). On la lit ICI,
     au rendu, plutot que d'attendre qu'un autre chemin veuille bien remplir
     `S.me` : c'est le seul endroit par lequel les plaques passent, donc le seul
     ou l'oubli ne peut pas se reproduire.

     ⚠️ CE N'EST PAS UNE VERITE, C'EST UN SOUVENIR. Ces nombres n'engagent rien :
     la bourse est arbitree par le serveur, et le premier `welcome` les remplace.
     Montrer la derniere valeur connue en attendant vaut mieux que ne rien
     montrer — un compteur absent se lit comme une perte. */
  /* ⛔ PENDANT LA PIRATERIE, LE BANDEAU CHANGE DE METIER. « Au lieu d'afficher
     mes pieces et mon rang, je prefere le palier et le capitaine courant, avec
     un menu deroulant des etoiles. » Le classement et la bourse n'ont rien a
     faire sur un ecran d'aventure solo : on montre OU l'on en est. */
  if (S.panel === 'campagne') { renderWalletCampagne(); return; }
  fermerDeroulantCampagne();
  if (!S.me) S.me = cale.moi();
  if (!S.me) return;
  /* Le rang suit la meme regle que la bourse : la derniere position connue
     plutot qu'un tiret, tant que le serveur n'a pas repondu. */
  if (!S.rang) S.rang = cale.rangConnu();
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
  /* ⛔ ET LA BARRE DU HAUT SE PEINT ICI, PAS SEULEMENT SUR REPONSE DU SERVEUR.
     `renderWallet` n'etait appele que depuis quatre gestionnaires de messages —
     l'accueil, la fiche joueur, les hauts faits, le classement. Aucun ne se
     declenche quand le serveur est injoignable : sans reseau, les trois plaques
     n'etaient jamais dessinees, et le joueur ouvrait le jeu sur une barre nue,
     comme si sa bourse avait ete videe.
     Le pont est le seul endroit par lequel on arrive sur cet ecran, avec ou sans
     reseau. C'est donc lui qui peint la barre, avec la derniere valeur connue
     s'il le faut (voir `renderWallet`). */
  renderWallet();
  renderMenu($('#dc-screen-menu'));
}

/* ─────────────────────────────────────────────── shop / ranking / rules ── */

/** Ouvrir une page depuis l'exterieur — les reglages y envoient les regles. */
export function ouvrirPanneau(nom) {
  /* ⛔ LES REGLES NE SONT PLUS UNE PAGE. Elles s'ouvrent en MODALE au-dessus de
     ce que le joueur regarde — voir `ouvrirRegles` — et laissent la navigation
     des pages tranquille. */
  if (nom === 'rules') { ouvrirRegles(); return; }
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
      renderWallet();
      fermerLecteur();
      S.sfx.play('shut', 0.2);
    }
    marquerOnglets();
    return;
  }
  if (S.panel === name) {
    S.panel = null;
    panel.classList.remove('on');
    renderWallet();
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
    /* Le bandeau change de metier sur la page Piraterie (voir renderWallet). */
    renderWallet();
    /* ⛔ UNE PAGE QU'ON OUVRE SE RELIT, TOUJOURS. « Quand je vais sur chaque
       page, un appel doit recharger les donnees » — vecu : un pseudo renomme
       restait a l'ancien nom dans le classement, une bourse changee gardait son
       vieux chiffre. Le classement se relisait deja ; la boutique, les hauts
       faits et le journal gardaient leur premiere lecture pour toute la
       session. On jette donc leur cache A L'OUVERTURE — et seulement la : le
       meme `refreshPanel` repasse aussi sur chaque `me`, et invalider a cet
       endroit-la aurait fait boucler demande et reponse. */
    if (name === 'shop') S.shop = [];
    else if (name === 'succes') S.succes = null;
    else if (name === 'replay') S.historique = null;
    else if (name === 'campagne') S.campagne = null;
    /* La bourse et le rang du bandeau suivent le meme principe. */
    if (S.net) S.net.send({ t: 'refresh' });
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
let relaisOnglet = 0;
const minuteursOnglet = new Map();

/**
 * ⚠️ 950 MS, ET C'EST MESURE. Les cinq animations sont construites pareil : le
 * mouvement dure de 700 a 880 ms, puis l'image de repos est TENUE une seconde
 * entiere. Rendre la main apres le mouvement le plus long — 880 ms pour les
 * hauts faits — et avant la fin de la plus courte tenue tombe donc dans une
 * fenetre ou l'ecran affiche deja, immobile, le fichier fixe : le relais ne se
 * voit pas. Garder l'APNG jusqu'au bout ne montrerait rien de plus et
 * retiendrait dix images decodees par bouton.
 */
const RETOUR_MS = 950;

function animerOnglet(bouton) {
  const img = bouton.querySelector('img');
  const art = bouton.dataset.art;
  if (!img || !art) return;
  /* Le minuteur vit ici et pas dans `dataset` : `dataset` ne garde que des
     chaines, et `clearTimeout('37')` n'annule rien du tout. Deux appuis
     rapproches auraient laisse le premier minuteur rendre la main au dessin
     fixe au milieu de la seconde animation. Une entree par bouton : deux
     onglets differents peuvent jouer en meme temps. */
  clearTimeout(minuteursOnglet.get(art));
  relaisOnglet = 1 - relaisOnglet;
  img.src = `${ASSETS}img/${art}_anim.png?${relaisOnglet ? 'a' : 'b'}`;
  minuteursOnglet.set(art, setTimeout(() => {
    img.src = `${ASSETS}img/${art}.png`;
  }, RETOUR_MS));
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
  if (S.panel === 'shop') renderShop(body);
  else if (S.panel === 'ranking') renderRanking(body);
  else if (S.panel === 'succes') renderSucces(body);
  else if (S.panel === 'replay') renderReplays(body);
  else if (S.panel === 'campagne') renderCampagne(body);
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
/**
 * Une graine tiree sur le telephone, pour les parties qui n'ont pas de jeton.
 *
 * ⚠️ ELLE NE PROUVE RIEN, ET C'EST TOUT LE POINT. La graine d'un jeton vient du
 * serveur : c'est elle qui lui permet de rejouer la partie coup par coup et de
 * verifier qu'on n'a pas menti sur les des. Une graine tiree ici ne se verifie
 * contre rien. La partie se joue, se gagne et se perd exactement pareil — elle
 * ne peut simplement pas etre CREDITEE.
 */
function graineLocale() {
  /* ⚠️ `Math.random` SUFFIT ICI, ET LE TIRAGE CRYPTOGRAPHIQUE SERAIT UN LEURRE.
     Une graine solide protege contre quelqu'un qui voudrait la DEVINER ; celle-ci
     n'a rien a proteger, puisqu'elle ne sert a prouver quoi que ce soit a
     personne. Elle doit seulement donner deux parties differentes deux fois de
     suite. (Et `Uint32Array` n'est pas dans les noms connus du controle de
     construction : une dependance de plus pour zero garantie de plus.) */
  return Math.floor(Math.random() * 4294967296);
}

export function jouerHorsLigne() {
  const jeton = cale.prendreUnJeton();
  /* ⛔ ON NE REFUSE PLUS DE JOUER. FAUTE DE JETON, LE JEU DISAIT SIMPLEMENT NON.
     Un joueur sans reseau qui avait epuise ses jetons — ou qui n'en avait jamais
     recu, parce qu'il n'a jamais rencontre le serveur — se retrouvait devant une
     application complete et parfaitement inerte : « le mode hors ligne doit
     marcher meme sans le serveur, l'IA doit etre totalement locale ».
     Elle l'est : le moteur, l'adversaire et les regles tournent sur le
     telephone. Le jeton ne sert PAS a jouer, il sert a PROUVER — c'est la
     graine du serveur qui lui permet de rejouer la partie et de la creer.
     Sans jeton, on joue donc quand meme, avec une graine locale ; simplement,
     cette partie-la ne sera pas creditee, et la carte de fin le dit. */
  const vrai = S.net;
  const poche = ouvrirPartieHorsLigne({
    jeton: jeton ? jeton.id : null,
    graine: jeton ? jeton.graine : graineLocale(),
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
         rend la main au vrai serveur.

         ⚠️ ET UNE PARTIE SANS JETON NE VA PAS DANS LA FILE. Le serveur la
         refuserait — « jeton inconnu ou deja servi » — et le joueur recevrait un
         « partie refusee » pour une partie qu'il a honnetement jouee. On ne
         promet rien qu'on ne puisse tenir : elle a ete jouee, elle ne compte
         pas, et la carte de fin le dit en toutes lettres. */
      /* ⚠️ ET UN JOURNAL INCOMPLET NON PLUS. `auJournal()` rend `null` quand le
         moteur a du cesser de noter : l'envoyer ferait regler la partie sur un
         prefixe, avec un score que le joueur n'a jamais vu. */
      const journal = poche.partie.auJournal();
      if (jeton && journal) cale.garderPartie(jeton.id, journal);
      S.poche = null;
      S.net = vrai;
      onOver(jeton ? m : Object.assign({}, m, { horsLigneLibre: true }));
      if (jeton) envoyerLesParties();
    },
    idle: () => { S.poche = null; S.net = vrai; S.state = null; S.seat = -1; showMenu(); },
    error: (m) => toast(messageServeur(m.msg), 'warn'),
  });
  /* ⚠️ LA POCHE EST PUBLIQUE, ET C'EST CE QUI PROTEGE LA PARTIE. `S.net` seul ne
     suffit pas a savoir qu'on joue hors ligne — la relance ne voit qu'un objet
     qui repond. Ce drapeau-la dit « ne touche pas », et `connect()` le lit. */
  S.poche = poche;
  S.net = poche;
  return true;
}

/* ───────────────────────────────────────────────────────────────── wiring ── */

export function initDice() {
  UI.showMenu = showMenu;
  UI.openPage = ouvrirPanneau;
  /* Le pont declenche la partie hors ligne : c'est lui qui porte le bouton, et
     il n'a pas a connaitre le faux serveur. */
  UI.jouerHorsLigne = jouerHorsLigne;
  /* Le panneau lateral se repeint depuis l'arene : elle sait quand la partie
     commence, ce que la boutique ne peut pas deviner toute seule. */
  UI.refreshPanel = refreshPanel;
  UI.leaveMatch = () => {
    /* ⛔ REVENIR AU PONT DETRUIT LE SALON DE CELUI QUI L'A OUVERT. Il survit
       desormais a la partie — c'est ce qui permet de rejouer avec le meme ami —
       et il faut donc un geste clair pour le fermer. « Il faut que celui qui a
       cree la session revienne dans le menu pour la detruire. »
       Le message est envoye par les DEUX joueurs : cote serveur, `closeRoomOf`
       ne ferme que les salons dont on est l'hote, donc c'est sans effet pour
       l'invite — et sans condition a tenir a jour de ce cote-ci. */
    if (S.salon && S.net && S.net.ready) S.net.send({ t: 'room', action: 'cancel' });
    S.salon = null;
    S.state = null; S.seat = -1; showMenu();
  };
  UI.renderWallet = renderWallet;
  UI.requestClose = requestClose;

  /* ── ce dont le tutoriel a besoin, et rien de plus ──────────────────────
     Le guide du premier lancement joue une VRAIE partie contre l'IA : il lui
     faut de quoi la demarrer et de quoi observer les gestes du joueur (lancer,
     poser, jouer un bonus). Deux crochets suffisent — il ne touche a rien. */
  UI.jouerSolo = () => {
    if (S.net && S.net.ready) { S.net.send({ t: 'play', mode: 'solo' }); return; }
    if (UI.jouerHorsLigne) UI.jouerHorsLigne();
  };
  UI.snapshotJeu = () => {
    const st = S.state;
    if (!st) return { phase: null };
    const grille = (st.grids && st.grids[S.seat]) || [];
    const poses = grille.filter((v) => v !== null && v !== undefined).length;
    const joues = (st.bonusJoues && st.bonusJoues[S.seat]) || [];
    return {
      phase: st.phase, seat: S.seat, turn: st.turn,
      monTour: st.turn === S.seat,
      de: st.dice ? st.dice[S.seat] : null,
      poses, bonus: joues.length, over: st.phase === 'over',
    };
  };
}
