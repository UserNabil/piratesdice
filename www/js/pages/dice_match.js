/* ============================================================================
   pages/dice_match.js — the table itself: two boards, the cup, the bonuses.

   The server sends a FULL authoritative state after every action, plus a small
   list of effects (`fx`) describing what just happened. Drawing is therefore a
   diff: the state says what must be on screen, the effects say what to animate.
   That is what removed the desync of the original game, which shipped eight
   different incremental events and trusted the client to keep up.

   One subtlety: when dice are destroyed, the state already has them gone. We
   hold the victim's board frozen while the explosions play, then redraw it —
   otherwise the dice would vanish before the player saw why.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { toast } from '../ui/toast.js';
import { S, UI, ASSETS, screen, boardOf, myTurn, bonusArt, fxUrl , skinOf, arrondiDeCase } from './dice_state.js';
import { t } from '../core/i18n.js';
import { buildBoard, renderBoard, markPlaced, blastCells, cupArt, dieFace,
         tumble, showLanding, clearLanding, freeCellOf } from './dice_board.js';
import { announce, renderForesee, startClock, MOODS, moodArt, sendMood } from './dice_fx.js';
import { captainArt, traitArt, captainName, captainTrait } from './dice_lobby.js';

/* BENCH TEMPORAIRE — retire par git checkout */
import { startClock as __bStartClock } from './dice_fx.js';
window.__pdBench = { S, startClock: __bStartClock, paint: (f) => paint(f) };

export function onMatch(m) {
  /* Une des trois boucles de partie, jamais la meme deux fois de suite. */
  if (S.musique) S.musique.jouer('partie');
  /* Trouver quelqu'un est un evenement : on l'entend. En solo, le depart est
     deja annonce par `start`. */
  if (S.sfx && m.mode === 'multi') S.sfx.play('trouve', 0.4);
  S.queued = false;
  S.lastScores = null;
  S.seat = m.seat;
  S.state = m.state;
  /* Une nouvelle table repart d'un etat vierge : sans cela l'alerte du tour,
     identique a celle de la partie precedente, ne se rejouerait pas. */
  oublierEtat();
  buildGame();
  screen('game');
  paint(true);
  /* ⛔ LA BOUTIQUE FERME SES CAISSES QUAND LA TABLE S'OUVRE. `enPartie()` n'est
     lu qu'au moment de dessiner le rayon : un panneau ouvert AVANT le debut de
     la partie gardait donc ses boutons d'achat vivants, et chaque clic partait
     se faire refuser par le serveur (409). Un bouton actif qui mene a un refus
     est pire qu'un bouton grise : il promet. */
  if (UI.refreshPanel) UI.refreshPanel();
  /* Une partie qui reapparait sans un mot ressemble a un bug. On nomme ce qui
     vient de se passer, sinon le joueur croit avoir relance au hasard. */
  if (m.resumed) toast(t('resume.done'), 'ok');
}

function buildGame() {
  const el = $('#dc-screen-game');
  /* ⚠️ CETTE ARENE SUIT LA MAQUETTE DE L'ADMIN, ET ELLE CHANGE TROIS CHOSES.

     1. LES DEUX JOUEURS SE FONT FACE AU CENTRE. Ils occupaient le haut et le
        bas de l'ecran, donc on ne pouvait pas comparer deux scores sans
        traverser l'ecran des yeux. Cote a cote autour du medaillon, l'ecart se
        lit d'un coup — c'est la seule information qui compte a chaque tour.
     2. LE GOBELET DESCEND DANS UN BANDEAU, avec la cale et la sortie. Trois
        boutons au pouce, la ou il n'y avait qu'un gobelet flottant.
     3. LA CALE S'OUVRE EN EVENTAIL. Le ratelier vivait dans la carte du joueur
        et lui disputait sa largeur ; il se deploie desormais au-dessus du
        bandeau, et ne coute rien quand il est ferme.

     Les identifiants ne bougent PAS (#dc-pc-me, #dc-pc-foe, #dc-cup, #dc-bonus,
     #dc-turn, #dc-quit, #dc-replay) : tout le reste du fichier s'y accroche. */
  el.innerHTML = `
    <div class="dc-arena">
      <div class="dc-boards">
        <div class="dc-board-slot" id="dc-slot-foe"></div>

        <!-- L'etat du jeu ne tient plus une ligne sous le rectangle : il passe
             AU-DESSUS, en alerte, et s'efface. Une phrase permanente qui repete
             « a vous » a chaque tour cesse d'etre lue au bout de trois tours,
             et prend une bande de hauteur aux plateaux pour ne rien dire. -->
        <div class="dc-versus-wrap">
          <div class="dc-turn" id="dc-turn" aria-live="polite"></div>
          <!-- ⛔ PLUS DE PANNEAU COMMUN ICI (la classe pd-panel a saute). Un seul cadre englobait les deux
               capitaines et le medaillon : la maquette montre DEUX CARTES
               SEPAREES, chacune avec son jonc creme, et le medaillon POSE DANS
               L'ECART entre elles, debordant en haut et en bas. Le panneau
               commun donnait un rectangle unique coupe en deux — pas la meme
               chose, et pas ce qui a ete dessine. -->
          <div class="dc-versus">
            <div class="dc-pc" id="dc-pc-foe"></div>
            <img class="dc-vs-mark" src="${ASSETS}img/icon_versus.png" alt="">
            <div class="dc-pc" id="dc-pc-me"></div>
          </div>
        </div>


        <div class="dc-board-slot" id="dc-slot-me"></div>
      </div>

      <!-- L'eventail de la cale, ferme par defaut. Il se pose AU-DESSUS du
           bandeau : deploye en dessous, le pouce qui l'ouvre le recouvrirait. -->
      <div class="dc-bonus" id="dc-bonus"></div>

      <div class="dc-foot">
        <button class="dc-foot-btn" id="dc-bag" title="${esc(t('bonus.head'))}">
          <img src="${ASSETS}img/icon_bag.png" alt="">
          <span>${esc(t('foot.bag'))}</span>
        </button>
        <button class="dc-foot-btn dc-foot-main" id="dc-cup" title="${esc(t('hdr.roll'))}">
          <!-- Le dessin vit dans un ecrin a lui : renderCup y ecrit le gobelet
               ou le de tire, et le libelle en dessous survit a la reecriture. -->
          <span class="dc-foot-art" id="dc-cup-slot"></span>
          <span>${esc(t('foot.roll'))}</span>
        </button>
        <!-- Rejouer prend la place du gobelet une fois la partie finie : c'est
             ce qu'on veut faire neuf fois sur dix, et le gobelet n'a plus rien
             a lancer. -->
        <button class="dc-foot-btn dc-foot-main" id="dc-replay" hidden>
          <img src="${ASSETS}img/icon_versus.png" alt="">
          <span>${esc(t('over.again'))}</span>
        </button>
        <button class="dc-foot-btn" id="dc-quit" title="${esc(t('game.leave'))}">
          <img src="${ASSETS}img/icon_leave.png" alt="">
          <span>${esc(t('foot.leave'))}</span>
        </button>
      </div>
    </div>
`;

  const foeWrap = buildBoard(1 - S.seat, true);
  const mineWrap = buildBoard(S.seat, false);
  $('#dc-slot-foe').appendChild(foeWrap);
  $('#dc-slot-me').appendChild(mineWrap);
  const foe = foeWrap.board;
  const mine = mineWrap.board;

  /* Survoler une colonne montre OU le de tomberait. C'est la seule facon de
     choisir sans compter les cases des yeux a chaque tour. */
  mine.querySelectorAll('.dc-col').forEach((col) => {
    col.onmouseenter = () => {
      if (!myTurn() || !S.state) return;
      if (S.state.pending && S.state.pending.seat === S.seat) return;
      const die = S.state.dice[S.seat];
      if (die === null) return;
      const cell = freeCellOf(S.state.grids[S.seat], parseInt(col.dataset.col, 10));
      if (cell >= 0) showLanding(mine, cell, die);
    };
    col.onmouseleave = () => clearLanding(mine);
    col.onclick = () => {
      if (S.state && S.state.pending && S.state.pending.seat === S.seat) return;
      if (!myTurn()) return;
      if (S.state.dice[S.seat] === null) { toast(t('game.rollFirst'), 'warn'); return; }
      clearLanding(mine);
      S.net.send({ t: 'place', column: parseInt(col.dataset.col, 10) });
    };
  });

  [foe, mine].forEach((board) => {
    board.querySelectorAll('.dc-cell').forEach((box) => {
      box.onclick = (ev) => {
        const pending = S.state && S.state.pending;
        if (!pending || pending.seat !== S.seat) return;
        if (parseInt(board.dataset.seat, 10) !== pending.target) return;
        /* ⚠️ UNE CIBLE DE COLONNE ACCEPTE UNE CASE VIDE. Le garde ci-dessous
           refusait tout ce qui n'etait pas un de deja pose : parfait pour un
           canon, mais une benediction se pose sur une colonne — vide comprise,
           et c'est meme la que le pari a le plus de sel. */
        if (!pending.column && !box.classList.contains('dc-cell-filled')) return;
        ev.stopPropagation();
        S.net.send({ t: 'cell', cell: parseInt(box.dataset.cell, 10) });
      };
    });
  });

  $('#dc-cup').onclick = () => {
    /* En visee, ce bouton DESARME : c'est la sortie de secours d'un effet
       arme par erreur, et elle doit passer avant tout le reste. */
    const vise = S.state && S.state.pending && S.state.pending.seat === S.seat;
    if (vise) { if (S.net) S.net.send({ t: 'unbonus' }); return; }
    if (!myTurn()) { toast(t('game.waitTurn'), 'warn'); return; }
    if (S.state.dice[S.seat] !== null) { toast(t('game.alreadyRolled'), 'warn'); return; }
    S.net.send({ t: 'roll' });
  };
  $('#dc-quit').onclick = () => UI.requestClose();
  /* ⚠️ LA CALE S'OUVRE TANT QU'ON APPUIE, ET SE REFERME QUAND ON LACHE.
     Au clic, l'eventail restait ouvert et il fallait viser le sac une seconde
     fois pour s'en debarrasser — deux gestes pour un coup d'oeil. A l'appui
     maintenu, le pouce ne quitte jamais l'ecran : on presse, on lit, on glisse
     sur l'effet voulu, on relache. Le fond s'assombrit pendant ce temps, pour
     que l'eventail se detache du plateau.
     Le relachement SUR un effet le joue : c'est `dc-bonus-btn` qui s'en charge,
     et on ne referme qu'apres, pour ne pas lui retirer sa cible. */
  const sac = $('#dc-bag');
  sac.addEventListener('pointerdown', (ev) => { ev.preventDefault(); basculerCale(); });
  /* Un clavier ou un lecteur d'ecran n'appuie pas : il active. La bascule reste
     donc disponible, sinon la cale serait hors d'atteinte sans doigt. */
  sac.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); basculerCale(); }
  });
  /* ⛔ CE GESTIONNAIRE FERMAIT LA CALE AVANT QUE LE CLIC N'ARRIVE, ET LE CLIC
     TOMBAIT SUR LE PLATEAU. Il datait de l'eventail qu'on ouvrait a l'appui
     maintenu : au relachement, il refermait la cale puis declenchait le jeton
     lui-meme. Depuis que la cale s'ouvre au clic, le navigateur envoie DE TOUTE
     FACON son propre clic apres le relachement — et comme la cale venait d'etre
     fermee, ce clic-la trouvait la colonne SOUS le jeton. Resultat vecu : « j'ai
     un de en main, je clique sur un bonus, ça depose le de PUIS ça joue le
     bonus » — le de perdu dans une colonne qu'on n'avait pas choisie, et
     l'effet gaspille sur un tour qui n'existait plus.
     Le jeton a son propre `onclick` : il suffit de le laisser faire, et de
     fermer la cale DEDANS, une fois le clic recu. */

  document.addEventListener('pointercancel', () => { if (caleOuverte()) fermerCale(); });

  /* ⚠️ CLIQUER AILLEURS FERME LA CALE **ET** DESARME L'EFFET. Un jeton joue
     attend une cible : tant qu'elle n'est pas choisie, le joueur est en visee,
     et rien hors du plateau ne devait le sortir de la. Un geste dans le vide
     est une facon de dire « non » — on la respecte.
     ⚠️ MAIS PAS UN GESTE SUR LE PLATEAU : c'est la que se choisit la cible. Ni
     sur le gobelet, qui porte deja l'annulation explicite pendant la visee. */
  /* ⚠️ EN CAPTURE, ET C'EST TOUT LE POINT. Ce gestionnaire doit passer AVANT
     ceux du plateau : c'est lui qui decide si le geste ferme la cale ou joue un
     coup, et il ne peut pas decider apres coup. */
  document.addEventListener('pointerdown', (ev) => {
    const dans = (sel) => !!ev.target.closest(sel);
    if (dans('#dc-bonus') || dans('#dc-bag')) return;

    /* ⛔ LE GESTE QUI FERME NE DOIT RIEN JOUER. Vecu, et perdu : cale ouverte,
       de deja lance, un doigt sur la grille pour refermer — et le de s'est
       pose la ou le doigt passait. « Ce n'est pas ce que je voulais faire, et
       j'ai perdu. » Un menu ouvert prend le geste suivant POUR LUI : on ferme,
       et on avale le clic qui va avec. Le coup se joue au geste d'apres, quand
       le joueur voit de nouveau son plateau en entier. */
    if (caleOuverte()) { fermerCale(); avaler(ev); return; }

    if (dans('.dc-board') || dans('#dc-cup') || dans('.dc-foot-btn')) return;
    const vise = S.state && S.state.pending && S.state.pending.seat === S.seat;
    if (vise && S.net) S.net.send({ t: 'unbonus' });
  }, true);
  wireMoodFan();
}

/* ─────────────────────────────────── parler sans clavier ────────────────── */

let fanTimer = 0;

function closeFan() {
  if (fanTimer) { clearTimeout(fanTimer); fanTimer = 0; }
  const ouvert = document.querySelector('.dc-fan');
  if (ouvert) ouvert.remove();
  const jeu = $('#dc-screen-game');
  if (jeu && !caleOuverte()) jeu.classList.remove('dc-assombri');
}

/* Le rayon de l'arc — LA MEME VALEUR QUE `--pd-fan-r` dans la feuille de style —
   et la place qu'un bouton demande autour de lui. Le rayon vient de la corde
   minimale entre deux boutons voisins ; le detail est note cote CSS. */
const FAN_RAYON = 112;
const FAN_MARGE = 26;

/**
 * De quel cote l'eventail peut-il s'ouvrir ?
 *
 * ⚠️ UN ARC SYMETRIQUE SORTAIT DE L'ECRAN. Sur telephone le portrait du joueur
 * est colle au bord GAUCHE de son bandeau : un arc de -60° a +60° envoyait les
 * deux premieres humeurs en dehors de la page, ou elles etaient invisibles et
 * intouchables — mesure a l'ecran, deux boutons sur cinq hors cadre.
 *
 * On regarde donc la place reellement disponible autour du portrait et on choisit
 * le quart de tour qui tient. C'est mieux qu'une valeur pour le telephone et une
 * autre pour le bureau : la meme regle vaut pour une tablette, pour un ecran
 * partage, et pour le jour ou le bandeau changera de place.
 */
/**
 * LES ANGLES D'UN EVENTAIL, CALCULES SUR LA PLACE REELLEMENT LIBRE.
 *
 * ⛔ LA VERSION PRECEDENTE CHOISISSAIT UN QUART DE TOUR PARMI TROIS. Trois
 * dispositions ecrites a la main — « ouvre a droite », « ouvre a gauche »,
 * « ouvre en bas » — selectionnees par trois tests de distance. Ca marche tant
 * que l'ancre est franchement d'un cote ; entre deux, on tombait sur la mauvaise
 * disposition et le dernier bouton sortait de l'ecran. C'est ce que l'admin a
 * photographie : le cinquieme emoji coupe par le bord droit.
 *
 * ⚠️ ET AUCUN DES TROIS CAS NE GARANTISSAIT QUOI QUE CE SOIT. Ils choisissaient
 * une direction, pas un resultat : personne ne verifiait qu'a l'arrivee les N
 * boutons etaient bien dans le cadre.
 *
 * On renverse donc la question. Pour chaque angle possible on SAIT dire si le
 * bouton y tiendrait — c'est de la trigonometrie et quatre bords. On balaie le
 * tour complet, on garde le plus grand arc continu ou tout tient, et on y range
 * les boutons. La reponse est alors juste par construction, sur n'importe quel
 * ecran et pour n'importe quelle ancre.
 */
export function anglesEventail(ancre, combien, options) {
  if (combien <= 0) return [];
  const o = options || {};
  const rayon = o.rayon || FAN_RAYON;
  const demi = (o.taille || 44) / 2;
  const marge = o.marge === undefined ? 6 : o.marge;

  /* ⚠️ LE CALCUL ET LE DESSIN DOIVENT PARTIR DU MEME POINT. Le solveur prenait
     le CENTRE de l'ancre ; la cale, elle, ouvre son arc depuis le HAUT du
     bandeau (`--pd-fan-y`), pour ne pas partir de sous le pouce. Quarante
     pixels d'ecart : le calcul jugeait les jetons libres et le CSS les posait
     sur le bandeau. Deux origines pour un seul arc, c'est un arc faux — et un
     faux qu'aucun des deux cotes ne peut voir seul. L'appelant donne donc
     l'origine quand ce n'est pas le centre. */
  const r = ancre.getBoundingClientRect();
  const cx = o.origine ? o.origine.x : r.left + r.width / 2;
  const cy = o.origine ? o.origine.y : r.top + r.height / 2;

  /* Le cadre : l'ecran, moins ce que l'entete du jeu recouvre en haut. Un
     bouton pose sous la barre est aussi perdu qu'un bouton hors de l'ecran. */
  const jeu = document.querySelector('#dicewrap .dc-arena');
  const boite = jeu ? jeu.getBoundingClientRect() : null;
  const hautLimite = (boite ? boite.top : 0) + demi + marge;
  const basLimite = (boite ? boite.bottom : window.innerHeight) - demi - marge;
  const gaucheLimite = demi + marge;
  const droiteLimite = window.innerWidth - demi - marge;

  /* ⚠️ « DANS L'ECRAN » NE SUFFIT PAS. Un jeton pose sur le bandeau du bas est
     dans le cadre et pourtant inutilisable : il recouvre les trois boutons, et
     c'est la main qui tient l'eventail qui est dessous. On donne donc au calcul
     la liste des zones INTERDITES — le bandeau, et l'ancre elle-meme — et un
     angle n'est retenu que si le jeton n'en touche aucune. */
  const interdits = (o.evite || []).filter(Boolean);

  const tient = (deg) => {
    const a = deg * Math.PI / 180;
    const x = cx + rayon * Math.sin(a);
    const y = cy - rayon * Math.cos(a);
    if (x < gaucheLimite || x > droiteLimite || y < hautLimite || y > basLimite) return false;
    for (const z of interdits) {
      if (x + demi > z.left && x - demi < z.right
          && y + demi > z.top && y - demi < z.bottom) return false;
    }
    return true;
  };

  /* Le balayage part de la verticale HAUTE et s'ecarte de part et d'autre :
     a place egale, un eventail s'ouvre vers le haut, jamais vers le bas. */
  const PAS = 2;
  const ok = [];
  for (let d = -180; d <= 180; d += PAS) ok.push(tient(d));

  let debut = 0, fin = -1, longueur = -1;
  let i = 0;
  while (i < ok.length) {
    if (!ok[i]) { i++; continue; }
    let j = i;
    while (j + 1 < ok.length && ok[j + 1]) j++;
    /* A longueur egale, on prefere l'arc le plus proche du haut. */
    const centre = Math.abs(((i + j) / 2) * PAS - 180);
    const mieux = (j - i > longueur)
      || (j - i === longueur && centre < Math.abs(((debut + fin) / 2) * PAS - 180));
    if (mieux) { longueur = j - i; debut = i; fin = j; }
    i = j + 1;
  }

  /* Rien ne tient nulle part — ecran minuscule, ancre dans un coin : on rend
     l'arc du haut plutot que rien, et l'ecran fera ce qu'il pourra. */
  if (longueur < 0) {
    const pas = combien > 1 ? 120 / (combien - 1) : 0;
    const d0 = combien > 1 ? -60 : 0;
    return Array.from({ length: combien }, (_, k) => d0 + k * pas);
  }

  const a0 = -180 + debut * PAS;
  const a1 = -180 + fin * PAS;
  /* ⚠️ ON N'ETALE PAS SUR TOUT L'ARC DISPONIBLE. Deux boutons sur un demi-tour
     se retrouveraient dos a dos ; l'eventail doit rester un eventail. On borne
     l'ouverture a ce qu'il faut pour que les jetons se frolent sans se toucher,
     et on centre le tout dans la place libre. */
  const ecartMini = 2 * Math.asin(Math.min(1, (demi + 4) / rayon)) * 180 / Math.PI;
  const voulu = Math.min(a1 - a0, ecartMini * (combien - 1));
  const milieu = (a0 + a1) / 2;
  const depart = milieu - voulu / 2;
  const pas = combien > 1 ? voulu / (combien - 1) : 0;
  const angles = [];
  for (let k = 0; k < combien; k++) angles.push(depart + k * pas);
  return angles;
}

/**
 * ON POSE, ON REGARDE, ON RECALE.
 *
 * ⚠️ PREDIRE OU TOMBE UN JETON DEMANDE DE REFAIRE LE CALCUL DU NAVIGATEUR, ET
 * DE LE REFAIRE JUSTE. J'ai essaye : origine au centre de l'ancre d'un cote et
 * a son bord haut de l'autre, rayon lu dans une variable qui en cachait une
 * autre — deux fois le calcul a jure que tout tenait pendant que l'ecran
 * montrait le contraire. Deux verites sur une meme geometrie, c'est une de
 * trop.
 *
 * Le navigateur, lui, ne se trompe jamais sur ou il a mis les choses. On lui
 * demande donc : on pose l'eventail, on MESURE chaque jeton, et tant qu'un seul
 * sort du cadre ou retombe sur une zone interdite, on resserre l'arc et on le
 * redresse vers le haut. Quelques passes suffisent, et le resultat est vrai par
 * construction sur n'importe quel ecran.
 */
function calerEventail(jetons, angles, zones, rayon) {
  if (!jetons.length) return;
  const fan = jetons[0].parentNode;
  const cadre = document.querySelector('#dicewrap .dc-arena');
  const boite = cadre ? cadre.getBoundingClientRect() : null;
  const dedans = (r) => {
    if (r.left < 2 || r.right > window.innerWidth - 2) return false;
    if (boite && (r.top < boite.top + 2 || r.bottom > boite.bottom - 2)) return false;
    for (const z of zones) {
      if (z && r.right > z.left && r.left < z.right
          && r.bottom > z.top && r.top < z.bottom) return false;
    }
    return true;
  };

  const n = jetons.length;
  const cote = jetons[0].getBoundingClientRect().width || 46;
  let r = rayon;

  /* ⛔ ON NE RESSERRE PAS L'ARC JUSQU'A L'EMPILEMENT. Une premiere version
     reduisait l'ouverture de 12 % a chaque passe sans plancher : au bout de
     quelques tours les deux jetons se retrouvaient l'un SUR l'autre, au meme
     angle — vu a l'ecran, deux bonus superposes au bord du plateau. Un eventail
     ferme n'est plus un eventail.
     L'ouverture a donc un MINIMUM : celui qui laisse les jetons se froler sans
     se toucher. Quand meme ce minimum ne tient pas, ce n'est plus l'ecart qu'il
     faut reduire mais le RAYON — on ramene l'eventail contre son ancre, ou il y
     a toujours de la place. */
  for (let passe = 0; passe < 14; passe++) {
    const mini = 2 * Math.asin(Math.min(1, (cote / 2 + 4) / r)) * 180 / Math.PI;
    const plancher = mini * (n - 1);
    const ouverture = Math.max(plancher, angles[n - 1] - angles[0]);
    const milieu = ((angles[0] + angles[n - 1]) / 2) * Math.pow(0.8, passe);
    const pose = [];
    for (let k = 0; k < n; k++) {
      pose.push(n > 1 ? milieu - ouverture / 2 + (ouverture * k) / (n - 1) : milieu);
    }
    fan.style.setProperty('--pd-fan-r', r + 'px');
    jetons.forEach((b, k) => b.style.setProperty('--pd-angle', pose[k] + 'deg'));
    if (!jetons.some((b) => !dedans(b.getBoundingClientRect()))) return;
    /* Redresse d'abord, rapproche ensuite : on ne perd du rayon qu'apres avoir
       epuise les rotations. */
    if (passe >= 4) r = Math.max(52, r * 0.9);
  }
}

/**
 * L'EVENTAIL DES HUMEURS — UNE RANGEE, PAS UN ARC.
 *
 * ⛔ L'ARC S'OUVRAIT AUTOUR DU MEDAILLON, ET IL N'Y AVAIT PAS LA PLACE. Le
 * portrait est colle au bord de sa carte, dans une bande de cent pixels de haut
 * coincee entre les deux plateaux : un arc de rayon 112 en sortait forcement.
 * Mesure a l'ecran : cinq jetons, l'un sur le plateau du haut, l'un sur le nom,
 * l'un sur le plateau du bas, et le dernier a cheval sur le medaillon qu'on
 * venait de toucher. « Les icones s'ouvrent mal » — elles s'ouvraient la ou il
 * n'y avait rien a leur donner.
 *
 * La ou il y a de la place, c'est AU-DESSUS DU POUCE, juste au-dessus du
 * bandeau : la meme bande que la cale des effets, et le seul endroit de l'ecran
 * qu'aucun plateau ne dispute. Cinq dessins alignes, en grand, sur un fond
 * assombri — on les lit d'un coup d'oeil et on en vise un sans viser.
 */
function openFan(portrait) {
  closeFan();
  const jeu = $('#dc-screen-game');
  if (!jeu) return;
  const fan = document.createElement('div');
  fan.className = 'dc-fan';

  MOODS.forEach((humeur, i) => {
    const b = document.createElement('button');
    b.className = 'dc-fan-btn';
    /* Le glyphe reste l'intitule : un dessin sans nom n'est rien pour qui
       ecoute son ecran, et il sert de secours si l'image manque. */
    b.setAttribute('aria-label', humeur.glyphe);
    b.innerHTML = '<span><img src="' + moodArt(i) + '" alt="' + humeur.glyphe + '"></span>';
    b.onclick = (ev) => { ev.stopPropagation(); sendMood(i); closeFan(); };
    fan.appendChild(b);
  });

  jeu.appendChild(fan);
  jeu.classList.add('dc-assombri');
  /* La rangee se pose au-dessus du bandeau, quel qu'il mesure. */
  const pied = $('#dicewrap .dc-foot');
  if (pied) {
    const r = pied.getBoundingClientRect();
    const scene = jeu.getBoundingClientRect();
    fan.style.bottom = (scene.bottom - r.top + 12) + 'px';
  }
  /* ⚠️ HUIT SECONDES, PAS QUATRE. Il s'ouvrait au bout d'un appui long : le
     compte a rebours commencait donc quand le doigt etait deja la. Ouvert d'un
     clic, il faut le temps de LIRE cinq dessins avant d'en viser un. */
  fanTimer = setTimeout(closeFan, 8000);
}

/**
 * L'appui long, sur le portrait DU JOUEUR seulement.
 *
 * ⚠️ DELEGUE, PAS POSE SUR LE PORTRAIT. La carte du joueur est reconstruite par
 * `innerHTML` a chaque coup : un ecouteur pose dessus disparaitrait au premier
 * lancer. On ecoute donc l'ecran, qui lui ne bouge pas.
 *
 * ⚠️ `pointercancel` COMPTE AUTANT QUE `pointerup`. Sur telephone, un doigt qui
 * glisse pendant l'attente devient un defilement et le navigateur annule le
 * pointeur : sans cette ecoute, la minuterie survivait et l'eventail s'ouvrait
 * en plein geste de defilement.
 */
/* ⛔ IL FALLAIT APPUYER QUATRE CENT VINGT MILLISECONDES, ET PERSONNE NE LE
   SAVAIT. Un appui long est un geste qu'on ne decouvre pas : on tape sur son
   propre portrait, rien ne se passe, on en conclut qu'il ne fait rien. La cale
   des effets vient de perdre le meme geste pour la meme raison — un clic ouvre,
   un clic ailleurs ferme. Deux eventails, un seul geste a apprendre. */
function wireMoodFan() {
  const ecran = $('#dc-screen-game');
  if (!ecran) return;
  /* ⛔ UNE SEULE FOIS, ET LE GARDE EST POSE SUR L'ECRAN. */
  if (ecran.dataset.fanCable) return;
  ecran.dataset.fanCable = '1';

  ecran.addEventListener('pointerdown', (ev) => {
    const portrait = ev.target.closest('#dc-pc-me .dc-pc-portrait');
    if (!portrait) {
      /* Meme regle que la cale : le geste qui ferme ne joue pas. */
      if (!ev.target.closest('.dc-fan') && document.querySelector('.dc-fan')) {
        closeFan();
        avaler(ev);
      }
      return;
    }
    ev.preventDefault();
    if (document.querySelector('.dc-fan')) { closeFan(); return; }
    openFan(portrait);
  }, true);
  ecran.addEventListener('contextmenu', (ev) => {
    /* L'appui long ouvre le menu du navigateur sur Android : on le refuse LA ou
       le geste nous appartient, et nulle part ailleurs. */
    if (ev.target.closest('#dc-pc-me .dc-pc-portrait')) ev.preventDefault();
  });
}

export function onState(msg) {
  S.state = msg.state;

  const fx = msg.fx || [];
  const destroyed = fx.filter((f) => f.kind === 'destroy');
  const placed = fx.find((f) => f.kind === 'place');

  const rolled = fx.find((f) => f.kind === 'roll');

  /* L'IA a joue a la place d'un absent : on le DIT. Sans un mot, le joueur voit
     un de tomber tout seul et croit a un bug — c'est exactement ce qu'il faut
     eviter quand on automatise le tour de quelqu'un. */
  const away = fx.find((f) => f.kind === 'away');
  if (away && !S.awaySaid) {
    S.awaySaid = true;
    setTimeout(() => { S.awaySaid = false; }, 4000);
    toast(away.seat === S.seat ? t('away.you') : t('away.taken', { name: away.name }), 'warn');
  }

  if (fx.some((f) => f.kind === 'start')) S.sfx.play('start', 0.22);
  if (rolled) S.sfx.play('dice', 0.3);

  /* ⚠️ LE DE NE DOIT PAS APPARAITRE AVANT D'AVOIR ROULE. `paint()` ecrivait la
     face definitive dans le gobelet des l'arrivee de l'etat, et le roulement
     partait APRES : on voyait le resultat, puis un defilement de faces, puis le
     meme resultat. Le drapeau ferme le gobelet a `paint()` pendant le lancer. */
  if (rolled && rolled.seat === S.seat) S.rolling = true;

  paint(false, new Set(destroyed.map((f) => f.seat)));

  /* Le de du joueur ROULE avant de se fixer : le gobelet vient d'etre secoue. */
  if (rolled && rolled.seat === S.seat) {
    const cup = $('#dc-cup-slot') || $('#dc-cup');
    if (cup) tumble(cup, rolled.value, () => { S.rolling = false; if (S.state) renderCup(S.state); }, skinOf(S.seat));
    else S.rolling = false;
  }

  /* La pose : le MEME de, joue plus sec et plus haut que le lancer. */
  /* La pose : le MEME de, joue plus sec et plus haut que le lancer. */
  if (placed) { S.sfx.play('dice', 0.42, 1.28); markPlaced(boardOf(placed.seat), placed.cell); }

  let settleIn = 0;
  if (destroyed.length) {
    S.visualLock++;
    for (const one of destroyed) {
      settleIn = Math.max(settleIn, blastCells(boardOf(one.seat), one.cells, () => S.sfx.play('boom', 0.3)));
    }
    setTimeout(() => {
      S.visualLock = Math.max(0, S.visualLock - 1);
      paint(false, null, true);
    }, settleIn);
  }

  /* Les annonces passent APRES le dessin : un mot ne doit jamais arriver avant
     l'image qu'il commente. */
  announce(fx);

  /* ⛔ PAS D'ANIMATION DE CHANGEMENT DE TOUR. Elle a ete essayee (vague sur la
     barre, puis sur les plateaux, puis en voile sombre sur toute la zone) :
     elle n'apporte rien, elle coupe le rythme, et elle masquait la destruction.
     Le tour se lit deja par la lumiere (le plateau qui a la main est eclaire,
     l'autre recule) et par la carte du joueur actif. */
}

/** `frozen` holds the seats whose board must wait — their dice are still exploding. */
function paint(full, frozen, settle) {
  if (!S.state || S.seat < 0) return;
  const st = S.state;
  const foe = 1 - S.seat;

  if (!frozen || !frozen.has(S.seat)) renderBoard(boardOf(S.seat), st.grids[S.seat], st.columnScores[S.seat], settle);
  if (!frozen || !frozen.has(foe)) renderBoard(boardOf(foe), st.grids[foe], st.columnScores[foe], settle);

  popChangedScores(st);
  renderPlayerCard('#dc-pc-me', st, S.seat, true);
  renderPlayerCard('#dc-pc-foe', st, foe, false);
  startClock(st);
  stageBoards(st);
  renderTurn(st);
  renderExit(st);
  renderCup(st);
  renderBonusRack();
  renderTargeting(st);
  renderArrondi(st);
  renderQuarters(st);
  renderBoost(st);
  renderGel(st);
}

/**
 * LE GIVRE RESTE SUR LE PLATEAU TANT QUE LE GEL DURE.
 *
 * ⚠️ IL N'A D'ABORD ETE QU'UN ECLAIR. Le serveur n'annoncait le gel qu'au
 * moment ou il PREND effet — l'effet `frozen`, emis quand le tour est saute —
 * et le client en faisait un sceau plein cadre de 1,6 s. Entre le jeton joue et
 * le tour vole, rien : la victime ne savait pas ce qui l'attendait, et quand
 * elle l'apprenait c'etait deja passe. « Il faut que l'effet soit sur la grille,
 * a la bonne taille, et pendant TOUT le gel, pour comprendre. »
 *
 * L'etat `gele` voyage maintenant dans l'instantane. Le givre se pose donc sur
 * LE PLATEAU de celui qui va perdre son tour — pas au milieu de l'ecran — et il
 * y reste jusqu'a ce que le tour soit effectivement saute. On lit alors la
 * situation en regardant l'endroit ou elle se joue.
 */
/**
 * Poser le givre EXACTEMENT sur les cases, ni plus ni moins.
 *
 * ⛔ SEPT REGLAGES ONT ESSAYE DE FAIRE CE QUE FONT CES DIX LIGNES. Marge,
 * echelle, decalage en x, en y, et les trois memes pour mon cote : autant de
 * boutons pour faire coincider deux rectangles qui existaient deja. Chacun
 * etait un aveu — la boite du sceau n'etait pas la grille, alors on la
 * rattrapait a la main.
 *
 * ⚠️ ET L'INTERIEUR DU PLATEAU N'EST PAS LA GRILLE NON PLUS. Mesure au banc :
 * plateau 114→386, cases 123→377 — dix-huit pixels d'ecart. Ils viennent de la
 * rangee de plaques, dont le rembourrage (`--pd-frame`, 9 px) elargit le bloc,
 * donc le plateau qui s'y etire ; ses trois pistes deviennent plus larges que
 * les cases, qui s'y centrent. `inset: 0` posait donc le sceau a neuf pixels
 * des cases sur les quatre cotes.
 *
 * Ce qu'on veut est ce qu'on VOIT : la boite des neuf cases. On la mesure. Une
 * mesure ne se derregle pas et ne se demande pas deux fois — elle vaut pour les
 * deux plateaux, quel que soit le sens dans lequel ils sont empiles.
 */
function calerGel(board, el) {
  const cases = board.querySelectorAll('.dc-cell');
  let g = Infinity, h = Infinity, d = -Infinity, b = -Infinity;
  for (const c of cases) {
    const q = c.getBoundingClientRect();
    if (!q.width || !q.height) continue;
    g = Math.min(g, q.left); h = Math.min(h, q.top);
    d = Math.max(d, q.right); b = Math.max(b, q.bottom);
  }
  if (!isFinite(g)) return;
  /* ⚠️ LE REPERE D'UN ENFANT ABSOLU EST LA BOITE DE REMBOURRAGE : le cadre du
     plateau ne compte pas dans les coordonnees, il faut donc le retrancher. */
  const p = board.getBoundingClientRect();
  const st = getComputedStyle(board);
  const cg = parseFloat(st.borderLeftWidth) || 0;
  const ch = parseFloat(st.borderTopWidth) || 0;
  el.style.left = (g - p.left - cg) + 'px';
  el.style.top = (h - p.top - ch) + 'px';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.width = (d - g) + 'px';
  el.style.height = (b - h) + 'px';
}

function renderGel(st) {
  for (let seat = 0; seat < 2; seat++) {
    const board = boardOf(seat);
    if (!board) continue;
    const gele = !!(st.gele && st.gele[seat]) && st.phase === 'playing';
    const pose = board.querySelector('.dc-gel');
    if (!gele) { if (pose) pose.remove(); continue; }
    /* Deja la : on ne le refait pas, mais on le recale — la grille change de
       taille quand l'ecran tourne ou que `fit` repasse. */
    if (pose) { calerGel(board, pose); continue; }
    const el = document.createElement('div');
    el.className = 'dc-gel';
    el.innerHTML = '<img src="' + ASSETS + 'img/fx_freeze.png" alt="">'
      + '<span>' + esc(t(seat === S.seat ? 'fx.frozenYou' : 'fx.frozenWait')) + '</span>';
    /* ⚠️ DANS LE PLATEAU, PAS DANS LE BLOC. Le bloc contient aussi la rangee de
       plaques de score — et elle est SOUS le plateau d'en face, AU-DESSUS du
       mien : une boite calee dessus tombait a cote d'un cote sur deux. Posee
       dans le plateau, qui n'a pas de rembourrage, elle vaut la grille des deux
       cotes sans une seule soustraction. */
    board.appendChild(el);
    calerGel(board, el);
    /* Une fois de plus au tour suivant : a l'instant de l'insertion, la police
       du libelle peut encore manquer et le plateau bouger d'un pixel. */
    requestAnimationFrame(() => { if (el.isConnected) calerGel(board, el); });
  }
}

/* A chaque instant UN SEUL plateau compte : celui qui a la main est eclaire,
   l'autre recule. C'est ce qui remplace « deux rectangles equivalents ». */
function stageBoards(st) {
  /* ⛔ EXIGER `phase === 'playing'` LAISSAIT LES DEUX PLATEAUX NEUTRES. Toute
     phase qui n'est pas exactement celle-la — l'instant `ready` d'une table qui
     se met en place, une reprise apres coupure, tout etat intermediaire que le
     serveur enverrait un jour — retirait `dc-live` A TOUS LES DEUX sans poser
     `dc-idle` sur aucun : plus d'anneau dore, plus de retrait, deux rectangles
     identiques. C'est exactement ce que decrit « mon rectangle n'est plus actif
     quand c'est mon tour », et c'est le seul chemin du code qui le produise.

     Je n'ai pas su le reproduire — huit changements de camp, un effet joue, la
     cale ouverte et refermee : tout etait juste. Mais une condition qui n'a
     aucune raison d'etre la n'a pas besoin d'etre reproduite pour etre retiree.
     Ce qui compte est le TOUR ; la seule phase qui doit eteindre les deux, c'est
     la fin de partie, ou il n'y a plus de tour du tout. */
  const fini = st.phase === 'over';
  for (let seat = 0; seat < 2; seat++) {
    const board = boardOf(seat);
    const wrap = board && board.parentNode;
    if (!wrap || !wrap.classList.contains('dc-boardwrap')) continue;
    const live = !fini && st.turn === seat;
    wrap.classList.toggle('dc-live', live);
    wrap.classList.toggle('dc-idle', !fini && !live);
  }
}

/* Une plaque qui change de chiffre doit se faire remarquer : sans ca, le joueur
   ne voit jamais ce que son coup vient de rapporter. */
function popChangedScores(st) {
  if (!S.lastScores) S.lastScores = [[0, 0, 0], [0, 0, 0]];
  for (let seat = 0; seat < 2; seat++) {
    const board = boardOf(seat);
    if (!board || !board.parentNode) continue;
    for (let col = 0; col < 3; col++) {
      const value = st.columnScores[seat][col];
      if (value === S.lastScores[seat][col]) continue;
      S.lastScores[seat][col] = value;
      const plaque = board.parentNode.querySelector('.dc-colscore[data-col="' + col + '"]');
      if (!plaque || !value) continue;
      plaque.classList.remove('dc-plaque-pop');
      void plaque.offsetWidth;
      plaque.classList.add('dc-plaque-pop');
    }
  }
}

/*
 * Le portrait EST le capitaine choisi : le medaillon porte le liseré, le liseré
 * porte le trait. Un adversaire ne se reconnait plus a un visage tire de son
 * nom, mais a la facon dont il joue — ce qui est le sujet.
 */

/**
 * La cale a bonus, en pastilles.
 *
 * ⚠️ L'ADMIN NE VOYAIT PAS QUE L'IA EN AVAIT. Elle en jouait — le bandeau
 * l'annoncait au moment du coup — mais rien ne disait a l'avance qu'elle
 * pouvait le faire, si bien que son canon tombait du ciel. Deux ou trois
 * pastilles sous le nom suffisent : on sait ce qui peut arriver, donc on peut
 * jouer contre. Vide, la rangee disparait plutot que de montrer des trous.
 */
/**
 * Un objet de l'inventaire est-il JOUABLE en partie ?
 *
 * ⚠️ UNE PARURE N'EST PAS UN BONUS. L'inventaire porte tout ce que le joueur a
 * achete, jeux de des compris. Sans ce tri, un jeu de des apparaissait dans le
 * ratelier ET se comptait dans les pastilles sous le nom : le joueur voyait un
 * bonus qu'il n'avait jamais achete, appuyait dessus, et le serveur repondait
 * « unknown bonus ».
 *
 * ⛔ ET LE TRI SE FAISAIT PAR EXCLUSION, CE QUI L'A FAIT RATER UNE SECONDE FOIS.
 * « Tout sauf les parures » veut dire : toute categorie inventee plus tard est
 * jouable par defaut. Les gravures sont arrivees, et elles se sont rangees dans
 * le ratelier comme des effets — « je vois des bonus inconnus dans les
 * inventaires alors qu'aucun bonus n'a ete achete ». Le meme defaut, au meme
 * endroit, pour la meme raison.
 *
 * On nomme donc ce qui SE JOUE. Une categorie nouvelle n'entre plus dans la
 * cale sans qu'on l'y ait mise, et le prochain rayon de la boutique — quel
 * qu'il soit — ne pourra pas se glisser sous le pouce du joueur.
 *
 * La categorie vient du serveur. Quand elle manque — client plus recent que le
 * serveur, le temps d'un deploiement — l'identifiant tranche : les effets
 * commencent par B, tout le reste se porte.
 */
const CALE = ['Bonus', 'Malus'];

function jouable(i) {
  return i.category ? CALE.indexOf(i.category) >= 0 : /^B\d/.test(i.identify || '');
}

function stockMarkup(st, seat) {
  /* ⚠️ LE SERVEUR COMPTE UN PLAFOND, PAS UNE CALE. `bonusStock` dit combien
     d'effets il reste le DROIT de jouer dans la partie — trois au depart, pour
     tout le monde. Un joueur qui n'a rien achete voyait donc trois pastilles
     sous son nom et cherchait des bonus qu'il n'avait pas. Pour son propre
     siege, on compte ce qu'il possede vraiment ; pour l'IA d'en face, le chiffre
     du serveur est le bon, c'est elle qui detient la reserve. */
  let n = (st.bonusStock && st.bonusStock[seat]) || 0;
  if (seat === S.seat) {
    const enCale = (S.inventory || []).filter(jouable)
      .reduce((t, i) => t + (i.quantity > 0 ? i.quantity : 0), 0)
      + ((st.freeReroll && st.freeReroll[seat]) ? 1 : 0);
    n = Math.min(n, enCale);
  }
  /* ⚠️ UNE RANGEE QUI DISPARAIT DESEQUILIBRE LES DEUX CARTES. Elle n'etait
     dessinee que si le siege avait quelque chose : celui qui n'avait rien
     perdait une ligne entiere, et sa carte devenait plus courte que celle d'en
     face — deux moities censees se refleter autour du medaillon.

     Le plafond est le MEME pour tout le monde : trois effets par partie. Les
     trois emplacements sont donc toujours la, eteints quand ils sont vides.
     C'est aussi une information qu'on ne donnait pas : on voit ce qu'il reste a
     jouer, chez soi comme en face. */
  const plafond = (S.rules && S.rules.maxBonusPerMatch) || 3;
  n = Math.max(0, Math.min(n, plafond));
  /* ⚠️ `bonus1.png` EST LE NOM EN BASE, PAS LE NOM DU FICHIER. La table nomme
     les objets de gameplay ; les dessins vivent sous d'autres noms, et `bonusArt`
     fait la traduction. Ecrit en dur, le chemin donnait une image cassee — donc
     des pastilles presentes dans le DOM et invisibles a l'ecran. */
  let rangee = '';
  for (let i = 0; i < plafond; i++) {
    rangee += `<img class="dc-pc-chip${i < n ? '' : ' dc-pc-chip-vide'}"
                    src="${bonusArt('B001')}" alt="">`;
  }
  return `<div class="dc-pc-stock" title="${esc(t('bonus.left', { n }))}">${rangee}</div>`;
}

function renderPlayerCard(sel, st, seat, isMe) {
  const p = st.players[seat] || {};
  const el = $(sel);
  if (!el) return;
  /* ⛔ LA MEME CONDITION DE PHASE QUE POUR LES PLATEAUX, restee ici. Toute
     phase qui n'est pas exactement `playing` grisait LES DEUX cartes — plus
     personne d'actif, ni moi ni l'adversaire. C'est le rectangle d'information,
     pas le plateau, que l'admin voyait rester gris. Ce qui compte est le TOUR ;
     seule la fin de partie doit eteindre les deux. */
  const active = st.turn === seat && st.phase !== 'over';
  const cap = st.captains ? st.captains[seat] : null;
  /* ⚠️ L'ANNEAU DECORATIF EST PARTI. C'etait un cordage dessine en CSS, cale a
     -17 % autour d'un portrait rond — mais le medaillon porte MAINTENANT son
     propre anneau, peint dans l'image. Les deux cercles ne coincidaient pas :
     « les cercles sont mal places », et on ne savait toujours pas qui jouait.
     A la place, un seul cercle, et il VEUT DIRE quelque chose : c'est le temps
     qu'il reste avant que l'IA prenne la main. */
  /* ⚠️ LES DEUX CARTES SE FONT DESORMAIS FACE, AUTOUR DU MEDAILLON. Le portrait
     se tourne vers le centre — a gauche pour l'adversaire, a droite pour soi —
     et le score se pose contre le medaillon : c'est la que les yeux vont pour
     comparer, et un ecart se lit alors sans traverser l'ecran.
     Le ratelier n'est plus ICI : il vit dans l'eventail de la cale, sinon il
     disputait sa largeur au nom et le coupait en quatre lignes. */
  /* ⚠️ ON BASCULE, ON NE REECRIT PAS. `el.className = …` effacait tout ce que
     les autres passes avaient pose — la meche du tour (`dc-pc-timed`) en
     premier — et ne marchait que parce que `paint()` appelle la pendule JUSTE
     apres. Un ordre d'appel n'est pas un contrat : le jour ou quelqu'un rendra
     une carte ailleurs, la meche disparaitra sans que rien ne le dise. */
  el.classList.add('dc-pc');
  el.classList.toggle('dc-pc-mine', isMe);
  el.classList.toggle('dc-pc-theirs', !isMe);
  el.classList.toggle('dc-pc-active', active);
  el.classList.toggle('dc-pc-idle', !active);
  /* ⚠️ LE NOM EST SORTI DU BLOC D'IDENTITE, ET C'EST CE QUI LE FAIT TENIR.
     Il vivait avec l'elo et les pastilles dans une seule colonne, coincee entre
     le portrait et le score : « BARTHOLOMEW » disposait de 77 px pour 88, donc
     « BARTHOL… », quatre fois de suite malgre trois tentatives de rognage
     ailleurs. La maquette ne s'y prend pas comme ca — regarder l'image plutot
     que rapetisser les voisins : le nom y occupe TOUTE LA LIGNE DU HAUT, par-
     dessus le score, et seul le portrait lui prend de la largeur. Il a alors
     113 px pour 88, et la question ne se repose plus.
     C'est le CSS qui pose les quatre morceaux (voir `.dc-pc-theirs` et
     `.dc-pc-mine` dans dice.css) ; ici on se contente de ne plus les emboiter. */
  /* ⛔ LA MECHE ETAIT REFAITE A NEUF A CHAQUE INSTANTANE DU SERVEUR, ET ELLE NE
     CHANGE JAMAIS. Elle vivait dans ce `innerHTML` : chaque rendu de carte
     jetait son SVG, sa toile et sa flamme pour en reposer des identiques —
     donc jetait aussi le decoupage de la corde, qui doit alors se remesurer
     point par point. Mesure au banc, six tours contre l'IA, processeur bride
     six fois : 7787 `getPointAtLength` pour 2324 ms, soit 7 % du temps de la
     partie passe a redecouper une corde que personne n'a touchee. Trente
     redessins de carte, trente redecoupages.
     La meche est donc SORTIE du gabarit : on la detache, on reecrit la carte,
     on la remet. Elle est en position absolue sur le jonc — sa place dans
     l'ordre des enfants ne change rien a ce qu'on voit. */
  const horloge = el.querySelector('.dc-pc-clock') || meche();
  horloge.remove();
  el.innerHTML = `
    <div class="dc-pc-portrait">
      <img class="dc-pc-face" src="${captainArt(cap)}" alt="${esc(captainName(cap))}">
      <img class="dc-pc-trait" src="${traitArt(cap)}" alt="" title="${esc(captainTrait(cap))}">
    </div>
    <div class="dc-pc-name">${esc(p.name || '?')}${p.ai ? ` <em>${esc(t('game.ai'))}</em>` : ''}</div>
    <div class="dc-pc-id">
      <div class="dc-pc-elo">${p.rating} <img class="dc-insigne" src="${ASSETS}img/icon_elo.png"
           alt="${esc(t('menu.rang'))}" title="${esc(t('menu.rang'))}"></div>
      ${stockMarkup(st, seat)}
    </div>
    <div class="dc-pc-total" data-v="${st.totals[seat]}"
         aria-label="${esc(t(isMe ? 'game.yourScore' : 'game.theirScore'))}">${st.totals[seat]}</div>`;
  el.insertAdjacentElement('afterbegin', horloge);
}

/**
 * LA MECHE DE LA CARTE, FABRIQUEE UNE SEULE FOIS.
 *
 * ⚠️ LE COMPTE A REBOURS A QUITTE LE PORTRAIT POUR LE JONC DE LA CARTE. Il
 * tournait autour de l'avatar, ou il se battait avec l'anneau que chaque
 * capitaine porte DEJA peint dans son image : deux cercles concentriques mal
 * accordes, et le temps qui reste illisible sur 54 px de diametre. Le jonc de
 * la carte fait tout le tour du rectangle du milieu — il est quatre fois plus
 * long, il ne recouvre aucun dessin, et c'est deja lui qu'on regarde pour
 * savoir a qui est le tour.
 */
function meche() {
  const el = document.createElement('span');
  el.className = 'dc-pc-clock';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
      <svg class="dc-pc-meche" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path class="dc-meche-cendre"></path>
        <path class="dc-meche-trace"></path>
      </svg>
      <canvas class="dc-meche-corde"></canvas>
      <img class="dc-pc-flamme" src="${ASSETS}img/fx_meche.png" alt="">`;
  return el;
}

/*
 * Une partie finie doit TOUJOURS avoir une sortie visible. La carte de resultat
 * peut etre fermee (bouton RETOUR d'Android), et le joueur se retrouvait alors
 * devant un plateau mort — vu sur le telephone de l'admin. Le bouton de la
 * barre laterale change donc de role a la fin : il ramene au pont.
 */
/* ─────────────────────────── la cale, en eventail ───────────────────────── */

/* ⚠️ LE RATELIER OCCUPAIT UNE PLACE PERMANENTE POUR RIEN. Il vivait dans la
   carte du joueur, lui disputait sa largeur et coupait les noms — « Ann / e /
   Bon / ny ». Ferme, il ne coute plus rien ; ouvert, il se deploie AU-DESSUS du
   bandeau, sans quoi le pouce qui l'ouvre le recouvrirait. */
/* ⛔ LA CALE N'EST PLUS TENUE PAR UN DOIGT. Elle s'ouvrait a l'appui et se
   refermait au relachement : ouvrir pour REGARDER demandait de ne pas lever le
   pouce, et un tapotement la faisait disparaitre avant qu'on ait rien lu. Un
   clic l'ouvre, un clic ailleurs la ferme — et desarme l'effet au passage. */

/**
 * Avaler un geste : il a servi a fermer un menu, il ne servira a rien d'autre.
 *
 * ⚠️ IL FAUT TUER LE `click`, PAS SEULEMENT LE `pointerdown`. Ce sont deux
 * evenements distincts : arreter le premier n'empeche pas le second de partir,
 * et c'est le second que le plateau ecoute. On pose donc un garde a usage
 * unique, en capture, qui intercepte le clic qui suit — et qui se retire seul
 * si aucun ne vient (un glissement, un doigt qui sort de l'ecran).
 */
function avaler(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const tuer = (e) => { e.preventDefault(); e.stopPropagation(); };
  document.addEventListener('click', tuer, { capture: true, once: true });
  setTimeout(() => document.removeEventListener('click', tuer, true), 700);
}

function caleOuverte() {
  const rack = $('#dc-bonus');
  return !!(rack && rack.classList.contains('dc-bonus-open'));
}

function fermerCale() {
  const rack = $('#dc-bonus');
  if (rack) rack.classList.remove('dc-bonus-open');
  const sac = $('#dc-bag');
  if (sac) sac.classList.remove('dc-foot-on');
  const jeu = $('#dc-screen-game');
  if (jeu) jeu.classList.remove('dc-assombri');
}

function ouvrirCale() {
  const rack = $('#dc-bonus');
  if (!rack || caleOuverte()) return;
  renderBonusRack();
  if (!rack.children.length) { toast(t('bonus.empty'), 'warn'); return; }
  rack.classList.add('dc-bonus-open');
  const sac = $('#dc-bag');
  if (sac) sac.classList.add('dc-foot-on');
  const jeu = $('#dc-screen-game');
  if (jeu) jeu.classList.add('dc-assombri');
}

function basculerCale() {
  if (caleOuverte()) { fermerCale(); return; }
  ouvrirCale();
}

function renderExit(st) {
  const quit = $('#dc-quit');
  const replay = $('#dc-replay');
  if (!quit) return;
  const over = st.phase === 'over';
  /* ⚠️ ON NE TOUCHE PLUS AU CONTENU DE CE BOUTON : il porte une fleche, et lui
     ecrire un libelle par-dessus la remplacerait par le texte qu'on voulait
     justement eviter. Seul l'intitule d'accessibilite change de sens. */
  const dit = t(over ? 'over.back' : 'game.leave');
  quit.title = dit;
  quit.setAttribute('aria-label', dit);
  /* Le bandeau porte un libelle sous chaque dessin : celui de la sortie change
     de sens a la fin — on ne quitte plus une partie, on regagne le pont. */
  const mot = quit.querySelector('span');
  if (mot) mot.textContent = t(over ? 'foot.back' : 'foot.leave');

  /* ⚠️ REJOUER PREND LA PLACE DU GOBELET, IL NE S'AJOUTE PAS A COTE. Trois
     boutons tiennent dans le bandeau, quatre le compriment jusqu'a couper les
     libelles. Le gobelet n'a plus rien a lancer une fois la partie finie ; il
     s'efface et rend sa place. */
  const cup = $('#dc-cup');
  if (cup) cup.hidden = over;
  /* Le bandeau passe de trois colonnes a deux : seul cet endroit sait que la
     partie est finie, et le CSS ne peut pas le deviner d'un attribut `hidden`
     qui sert aussi pendant la partie. */
  const pied = cup && cup.parentElement;
  if (pied) pied.classList.toggle('dc-foot-over', over);
  if (replay) replay.hidden = !over;
  /* La cale ne sert plus a rien quand tout est joue. */
  const sac = $('#dc-bag');
  if (sac) sac.hidden = over;
  if (over) fermerCale();

  /* « Rejouer » n'existe qu'a la fin : pendant la partie il n'a pas de sens, et
     un bouton visible mais inerte est pire qu'un bouton absent. */
  if (replay) {
    replay.classList.toggle('dc-quit-exit', over);
    replay.onclick = () => {
      const mode = (S.state && S.state.mode === 'duel') ? 'multi' : 'solo';
      if (UI.leaveMatch) UI.leaveMatch(); else UI.showMenu();
      if (S.net) S.net.send({ t: 'play', mode });
    };
  }
  /* ⚠️ Sur telephone ce bouton est masque pendant la partie (la barre laterale
     n'existe pas) : il doit REAPPARAITRE a la fin, sinon la sortie reste
     invisible la ou le probleme a ete constate. */
  quit.classList.toggle('dc-quit-exit', over);
  quit.onclick = over
    ? () => { if (UI.leaveMatch) UI.leaveMatch(); else UI.showMenu(); }
    : () => UI.requestClose();
}

/* ⚠️ UNE ALERTE QUI RESTE N'EST PLUS UNE ALERTE. « A vous » ecrit en permanence
   sous le rectangle cessait d'etre lu au bout de trois tours, tout en prenant
   une bande de hauteur aux plateaux. Elle ne parait donc qu'au CHANGEMENT, et
   s'efface. Ce qui ne change pas — une partie en pause, une partie finie —
   reste affiche : la, l'information EST l'immobilite. */
let dernierEtat = '';
let dernierTour = -1;
let minuteurEtat = 0;

function direEtat(el, texte, classe, passager) {
  const signature = classe + '|' + texte;
  if (signature === dernierEtat) return;
  dernierEtat = signature;
  if (minuteurEtat) { clearTimeout(minuteurEtat); minuteurEtat = 0; }
  el.textContent = texte;
  el.className = 'dc-turn ' + classe + ' dc-turn-on';
  if (!passager) return;
  minuteurEtat = setTimeout(() => {
    el.classList.remove('dc-turn-on');
    minuteurEtat = 0;
  }, 1900);
}

export function oublierEtat() { dernierEtat = ''; }

/**
 * CHAQUE MESSAGE SORT DU COTE DU JOUEUR QU'IL CONCERNE.
 *
 * ⚠️ UNE PASTILLE CENTREE NE DIT PAS DE QUI ELLE PARLE. « A vous » et « Morgane
 * joue » s'affichaient au meme endroit, au-dessus du rectangle : il fallait LIRE
 * la phrase pour savoir qui etait concerne, a chaque tour, alors que la reponse
 * pouvait etre donnee par la simple position du mot.
 *
 * La regle vaut pour tout l'ecran, et c'est ce qui la rend lisible : ce qui me
 * concerne parait EN BAS, du cote de mon plateau ; ce qui concerne l'autre parait
 * EN HAUT, du sien. Les bulles de repliques suivaient deja cette regle ; l'alerte
 * de tour et les bannieres d'effet s'y rangent a leur tour.
 */
function renderTurn(st) {
  /* ⚠️ UNE PARTIE EN PAUSE DOIT LE DIRE. Sans ce mot, un joueur dont
     l'adversaire vient d'etre coupe voit une table qui ne repond plus, sans
     savoir si c'est le jeu, son telephone, ou son tour. */
  const el = $('#dc-turn');
  if (!el) return;
  /* Ce qui concerne la TABLE et non un joueur reste au centre, en haut : une
     pause ou une fin de partie n'appartiennent a personne. */
  /* ⚠️ « EN PAUSE » NE DISAIT NI QUI NI JUSQU'A QUAND. Deux mots dans une
     pastille au-dessus de la carte, pendant que l'adversaire tentait de
     revenir : le joueur restait devant une table muette sans savoir si elle
     repartirait. Le serveur publie maintenant le siege absent et le temps qu'on
     lui laisse ; on le dit, avec les secondes qui descendent. */
  if (st.paused) {
    const qui = st.pausedSeat === S.seat
      ? t('game.pausedYou')
      : t('game.pausedThem', {
          name: (st.players[st.pausedSeat] || {}).name || t('game.opponent'),
          n: Math.ceil((st.pausedMs || 0) / 1000),
        });
    direEtat(el, qui, 'dc-turn-paused dc-turn-haut', false);
    return;
  }
  /* La phase d'attente ne dure plus qu'un battement — le temps que les deux
     sieges soient la — mais elle existe encore, et un ecran muet pendant une
     seconde se lit comme une panne. */
  if (st.phase === 'ready') { direEtat(el, t('game.waitingTable'), 'dc-turn-haut', false); return; }
  if (st.phase === 'over') { direEtat(el, t('game.matchOver'), 'dc-turn-haut', false); return; }
  const mine = st.turn === S.seat;
  /* ⚠️ UN SEUL SON PAR CHANGEMENT DE MAIN. `renderTurn` passe a chaque etat —
     un de lance, une pastille qui bouge — et sonner a chaque fois ferait un
     tic-tac permanent. On ne sonne que lorsque la main CHANGE de cote. */
  if (mine && dernierTour !== st.turn) S.sfx.play('tour', 0.3);
  dernierTour = st.turn;
  direEtat(el,
    mine ? t('game.yourTurn')
         : t('game.playing', { name: (st.players[st.turn] || {}).name || t('game.opponent') }),
    mine ? 'dc-turn-mine dc-turn-bas' : 'dc-turn-haut', true);
}

function renderCup(st) {
  const cup = $('#dc-cup');
  if (!cup) return;
  const die = st.dice[S.seat];
  const canRoll = st.phase === 'playing' && st.turn === S.seat && die === null;
  /* Le gobelet est LE MIEN : il montre donc mes des. */
  const ecrin = $('#dc-cup-slot') || cup;
  /* ⛔ IL SE REECRIVAIT A CHAQUE ETAT RECU, MEME IDENTIQUE. `renderCup` passe a
     chaque message du serveur — un lancer d'en face, une pose, un effet, une
     humeur — et refaisait son `innerHTML` a chaque fois, y compris quand le
     dessin ne changeait pas d'un pixel. Or ce dessin porte un filtre : chaque
     reecriture detruit l'image, en recree une, et le navigateur recalcule
     l'ombre portee. C'est ce qu'on voit clignoter DERRIERE le de — une ombre
     noire qui repart de zero plusieurs fois par tour.

     On ne reecrit donc que si le contenu change vraiment. Le drapeau vit sur
     l'element : deux tours plus tard, on sait encore ce qu'il porte. */
  if (!S.rolling) {
    const quoi = die === null ? 'cup:' + (canRoll ? 1 : 0) : 'die:' + die + ':' + (skinOf(S.seat) || '');
    if (ecrin.dataset.montre !== quoi) {
      ecrin.innerHTML = die === null ? cupArt(canRoll) : dieFace(die, false, skinOf(S.seat));
      ecrin.dataset.montre = quoi;
    }
  }
  cup.classList.toggle('dc-cup-ready', canRoll);
  cup.classList.toggle('dc-cup-armed', die !== null && st.turn === S.seat);
  /* ⚠️ QUAND CE N'EST PAS MON TOUR, LE BOUTON DOIT LE DIRE AVANT QU'ON APPUIE.
     Il gardait son or et son relief pendant tout le tour d'en face : on le
     visait, et on recevait un mot d'attente en retour. Un bouton qui a l'air
     jouable et ne l'est pas fait perdre un geste a chaque tour.
     Il reste CLIQUABLE, et c'est deliberé : eteint, il explique ; desactive,
     il se tairait. */
  cup.classList.toggle('dc-cup-eteint',
    st.phase === 'playing' && st.turn !== S.seat);
  cup.disabled = st.phase !== 'playing';

  /* ⚠️ LE DE ADVERSE SE POSAIT DANS LE COIN DE LA CARTE, JUSTE AU-DESSUS DU
     SCORE. Tant que le total tient sur un chiffre les deux boites se ratent ; a
     trois chiffres le score s'etend et passe dessous. On l'accroche au
     MEDAILLON : le portrait a une taille fixe, donc le de a une place fixe, et
     il ne peut plus rencontrer un chiffre quelle que soit sa longueur. */
  const foeDie = st.dice[1 - S.seat];
  const medaillon = $('#dc-pc-foe .dc-pc-portrait');
  if (medaillon && foeDie !== null) {
    const badge = document.createElement('div');
    badge.className = 'dc-foe-die';
    badge.innerHTML = dieFace(foeDie, false, skinOf(1 - S.seat));
    medaillon.appendChild(badge);
  }
  renderForesee(st, dieFace);
}

/**
 * Le ratelier vit DANS le bandeau du joueur, et il y est recree a chaque coup.
 *
 * ⚠️ `renderPlayerCard` refait son `innerHTML` : le conteneur du ratelier
 * dispararait donc a chaque etat recu. C'est pourquoi cette fonction est appelee
 * APRES elle dans `paint()` — l'ordre n'est pas cosmetique, il est structurel.
 */
export function renderBonusRack() {
  const rack = $('#dc-bonus');
  if (!rack || !S.state) return;
  const left = S.state.bonusLeft ? S.state.bonusLeft[S.seat] : 0;
  /* ⚠️ L'EFFET OFFERT PAR LE CAPITAINE N'EST PLUS FORCEMENT LA RELANCE.
     Chaque capitaine en offre un — relance, longue-vue ou benediction — et il
     apparait dans le ratelier meme sans jeton en cale, sinon le trait resterait
     invisible a qui n'a rien achete. Le serveur dit LEQUEL. */
  const offert = (S.state.freeBonus && S.state.freeBonus[S.seat]) || null;
  const owned = S.inventory.filter((i) => i.quantity > 0 && jouable(i));

  /* ⚠️ RIEN A MONTRER, DONC RIEN A L'ECRAN. Un bandeau « aucun bonus en cale »
     occupait une place permanente pour dire qu'il n'y avait rien a dire. */
  if (!owned.length && !offert) {
    rack.innerHTML = '';
    return;
  }
  /* L'effet offert ne se compte pas deux fois : s'il en reste aussi en cale, il
     n'apparait qu'une seule fois, gratuit — c'est celui-la qu'on depense d'abord. */
  /* ⚠️ UN EFFET DEJA JOUE RESTE VISIBLE, MAIS ETEINT. Le serveur refuse le
     second usage (un effet par partie) : le retirer du ratelier ferait
     disparaitre un jeton sans explication, et le joueur croirait l'avoir
     perdu. Il reste a sa place, grise, et son infobulle dit pourquoi. */
  const joues = (S.state.bonusJoues && S.state.bonusJoues[S.seat]) || [];
  const boutons = owned.filter((i) => i.identify !== offert);
  /* ⚠️ UN INTERIEUR EN PLUS, ET IL N'EST PAS DECORATIF. Le jeton est pose sur
     l'arc par une rotation ; sans un enfant qui la DEFAIT, le dessin et son
     compteur penchent de l'angle du jeton — c'est exactement le piege qu'on
     avait deja rencontre avec les humeurs, et la meme parade. */
  const bouton = (id, titre, badge, cadeau) => `
      <button class="dc-bonus-btn${cadeau ? ' dc-bonus-free' : ''}${joues.includes(id) ? ' dc-bonus-joue' : ''}"
              data-id="${esc(id)}" data-nom="${esc(titre)}"
              title="${esc(titre)} — ${esc(joues.includes(id) ? t('bonus.spent') : t('bonus.left', { n: left }))}">
        <span class="dc-bonus-in">
          <img src="${bonusArt(id)}" alt="">
          <span class="dc-bonus-qty">${esc(String(badge))}</span>
        </span>
      </button>`;

  const tous = (offert ? [bouton(offert, t('shop.' + offert + '.name'), t('bonus.free'), true)] : [])
    .concat(boutons.map((i) => bouton(i.identify, i.description, i.quantity, false)));

  rack.innerHTML = tous.join('');

  /* ⛔ L'EVENTAIL A VECU. Il tenait pour trois jetons ; a cinq ou six, l'arc se
     resserrait jusqu'a ce qu'ils se recouvrent — « ça affiche mal quand tu as
     plusieurs bonus ». Un arc a une longueur, donc un nombre de places : au-dela
     il ne reste que le choix de mal l'afficher. Une GRILLE, elle, n'a pas cette
     limite ; elle passe a la ligne.
     Elle se pose au meme endroit que la rangee des humeurs — juste au-dessus du
     bandeau, la seule bande que les plateaux ne disputent pas — et c'est le CSS
     qui la centre : plus un seul angle a calculer. */
  const pied = $('#dicewrap .dc-foot');
  if (pied) {
    const r = pied.getBoundingClientRect();
    const scene = rack.offsetParent
      ? rack.offsetParent.getBoundingClientRect()
      : { bottom: window.innerHeight };
    rack.style.bottom = (scene.bottom - r.top + 12) + 'px';
  }

  /* ⚠️ UN BOUTON DESACTIVE NE DIT RIEN, ET SUR TELEPHONE IL NE DIT MEME PAS SON
     NOM : il n'y a pas de survol, donc pas d'infobulle. Le joueur appuyait sur un
     jeton grise sans savoir ni a quoi il sert, ni pourquoi il ne part pas. Le
     bouton reste donc VIVANT : il repond, et ce qu'il repond est la raison —
     exactement ce que fait deja le gobelet quand ce n'est pas votre tour. */
  /* ⚠️ LE GEL POUVAIT SE MARTELER. Le serveur refuse bien un second gel tant que
     le premier n'a pas ete consomme — `check` de B006 — mais l'ecran, lui, ne
     disait rien : le jeton restait vif, on appuyait, et le refus revenait en
     message d'erreur. Trois appuis, trois erreurs, et l'impression que le jeu
     ne repond pas. Un bouton qui ne peut rien faire doit le montrer AVANT. */
  const dejaGele = !!(S.state.gele && S.state.gele[1 - S.seat]);
  rack.querySelectorAll('.dc-bonus-btn').forEach((b) => {
    const cadeau = b.classList.contains('dc-bonus-free');
    const epuise = left <= 0 && !cadeau;
    const redondant = b.dataset.id === 'B006' && dejaGele;
    b.classList.toggle('dc-bonus-mute', !myTurn() || epuise || redondant);
    b.onclick = (ev) => {
      /* ⚠️ CE CLIC NE VA NULLE PART D'AUTRE. La cale se dessine PAR-DESSUS le
         plateau : tout ce qui remonte ou retombe finit sur une colonne. */
      ev.preventDefault();
      ev.stopPropagation();
      const nom = b.dataset.nom || '';
      /* Un refus laisse la cale OUVERTE : le joueur vient de lire pourquoi, il
         doit pouvoir viser un autre jeton sans tout rouvrir. */
      if (!myTurn()) { toast(nom + ' — ' + t('game.waitTurn'), 'warn'); return; }
      if (epuise) { toast(nom + ' — ' + t('bonus.left', { n: 0 }), 'warn'); return; }
      if (redondant) { toast(t('fx.alreadyFrozen'), 'warn'); return; }
      S.net.send({ t: 'bonus', identify: b.dataset.id });
      /* L'effet part : la cale n'a plus rien a montrer, et le plateau doit
         redevenir visible — c'est lui qu'on va viser si l'effet demande une
         cible. */
      fermerCale();
    };
  });
}

/**
 * La colonne benie porte une marque, jusqu'a la fin.
 *
 * ⚠️ UN EFFET PERMANENT SANS TRACE VISIBLE N'EXISTE PAS POUR LE JOUEUR. Les
 * 15 % s'appliquaient bien au score, mais rien ne disait OU : on voyait un total
 * qui ne tombait pas juste, sans pouvoir refaire le calcul. La plaque de la
 * colonne le dit, des deux cotes — c'est une information publique, elle change
 * le calcul de l'adversaire aussi.
 */
/**
 * Les trois quarts du pont, sur les plaques de score.
 *
 * ⚠️ UNE REGLE QU'ON NE VOIT PAS N'EXISTE PAS. Le multiplicateur change chaque
 * pose, mais il ne change RIEN au comportement du joueur tant qu'il n'est pas
 * lisible sur la colonne qu'il pondere. On l'ecrit donc a l'endroit ou l'on
 * regarde deja le score, et des deux cotes — c'est une information publique, elle
 * pese sur le calcul de l'adversaire autant que sur le sien.
 */
/**
 * Chaque plateau cale l'arrondi de ses logements sur les dés qu'il accueille.
 *
 * ⚠️ UNE VALEUR UNIQUE NE PEUT PAS CONVENIR À SIX JEUX. Les arrondis livrés vont
 * de 16 % à 26 % : un logement figé laisse des coins vides autour des uns et
 * mord sur les autres. La valeur descend donc du plateau, par variable CSS.
 */
function renderArrondi(st) {
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (!board) return;
    board.style.setProperty('--pd-cell-round',
      (arrondiDeCase(skinOf(seat)) * 100).toFixed(2) + '%');
  });
}

function renderQuarters(st) {
  const q = st.quarters;
  if (!q) return;
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (!board || !board.parentNode) return;
    board.parentNode.querySelectorAll('.dc-colscore').forEach((plaque) => {
      const col = parseInt(plaque.dataset.col, 10);
      const m = q[col];
      if (typeof m !== 'number') return;
      /* ⛔ LA COLONNE NEUTRE N'AFFICHAIT RIEN, ET SON SILENCE SE LISAIT MAL.
         L'idee etait de ne pas voler la place aux deux qui comptent — mais sur
         quatre colonnes, une pastille absente ressemble a une pastille qui n'a
         pas fini de charger, pas a « celle-ci vaut son prix ». Les quatre
         parlent maintenant, et c'est la COULEUR qui hierarchise : dorée pour
         celle qui rapporte, terne pour celle qui coute, neutre pour x1. */
      plaque.dataset.quart = '×' + String(m).replace('.', ',');
      plaque.classList.toggle('dc-colscore-riche', m > 1);
      plaque.classList.toggle('dc-colscore-pauvre', m < 1);
    });
  });
}

function renderBoost(st) {
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (!board || !board.parentNode) return;
    const beni = (st.boostCol && st.boostCol[seat]);
    board.parentNode.querySelectorAll('.dc-colscore').forEach((plaque) => {
      const col = parseInt(plaque.dataset.col, 10);
      plaque.classList.toggle('dc-colscore-boost', col === beni && beni >= 0);
      if (col === beni && beni >= 0) plaque.title = t('fx.boost');
    });
  });
}

function renderTargeting(st) {
  const game = $('#dc-screen-game');
  const pending = st.pending && st.pending.seat === S.seat ? st.pending : null;
  game.classList.toggle('dc-targeting', !!pending);
  /* ⚠️ UNE BENEDICTION VISE UNE COLONNE, PAS UNE CASE — et une colonne VIDE est
     une cible parfaitement valable, c'est meme le pari le plus interessant. Les
     regles de ciblage n'allumaient que les cases occupees : sur un plateau neuf,
     l'effet aurait ete impossible a poser. */
  game.classList.toggle('dc-targeting-col', !!(pending && pending.column));
  [0, 1].forEach((seat) => {
    const board = boardOf(seat);
    if (!board) return;
    const vise = !!pending && pending.target === seat;
    board.classList.toggle('dc-target', vise);
    /* ⛔ LA GRILLE QU'ON VISE EST CELLE D'EN FACE — DONC CELLE QUI EST EN
       RETRAIT. Le voile de l'attente la recouvrait pendant toute la visee :
       « la grille adverse ne s'active pas pour que le joueur puisse voir ». On
       demande au joueur de choisir une case sur un plateau qu'on assombrit.
       La marque va sur l'ENVELOPPE parce que c'est elle qui porte le voile, et
       qu'aucun selecteur ne remonte d'un enfant a son parent. */
    const env = board.parentNode;
    if (env && env.classList.contains('dc-boardwrap')) env.classList.toggle('dc-vise', vise);
  });
  /* ⚠️ UN EFFET ARME NE POUVAIT PLUS ETRE DESARME. Le serveur sait pourtant le
     faire depuis le debut — le message `unbonus` et `cancelBonus()` existent —
     mais rien a l'ecran ne l'appelait : un joueur qui armait un canon par erreur
     restait bloque en visee jusqu'a ce que la pendule joue a sa place. Le seul
     moyen d'en sortir etait de perdre son tour.
     Le bandeau du bas prend donc le role d'annulation pendant la visee : c'est
     le bouton qu'on a deja sous le pouce, et il ne sert a rien d'autre a cet
     instant precis. */
  const cup = $('#dc-cup');
  if (cup) {
    cup.classList.toggle('dc-cup-annule', !!pending);
    const mot = cup.querySelector('span:last-child');
    if (mot) mot.textContent = pending ? t('game.cancelBonus') : t('foot.roll');
  }
  if (pending) {
    const turn = $('#dc-turn');
    if (turn) turn.textContent = t('game.pickBlast');
  }
}

/* ⛔ `rain` EST PARTIE DANS `dice_end.js`, ET C'ETAIT UN BOGUE MUET. Elle
   vivait ici, sans `export`, et la carte de fin l'appelait : `ReferenceError`
   a chaque VICTOIRE, avalee par le `try` du routeur de messages. Le gagnant
   restait devant un plateau mort — la carte etait construite mais jamais
   affichee, la ligne qui l'allume venant apres l'appel. Une fonction n'habite
   pas un fichier qui ne s'en sert pas. */
