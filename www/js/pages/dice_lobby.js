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
import { S, UI, ASSETS, screen } from './dice_state.js';
import { jetons } from './dice_cale.js';

/* ⛔ CETTE LISTE FILTRE CELLE DU SERVEUR (voir `known`), ET C'EST LE PIEGE.
   Elle n'est pas qu'un repli pour le premier rendu : `listeCapitaines()` ecarte
   tout identifiant qui n'y figure pas. Un capitaine ajoute cote serveur et
   oublie ici n'apparaitrait donc JAMAIS a l'ecran — pas de cadenas, pas de
   medaillon, rien du tout, et aucun message pour le dire. L'ordre est celui du
   deverrouillage, comme sur le serveur. */
const CAPTAIN_IDS = ['read', 'jack', 'ching', 'teach', 'omalley',
                     'bonny', 'bart', 'lionne', 'morgan', 'levasseur',
                     /* Le second lot. L'avertissement ci-dessus s'est verifie a
                        la lettre : ces cinq-la existaient cote serveur, avec
                        leurs effets, leurs seuils et leurs portraits, et ne
                        seraient apparus nulle part — `known()` les aurait
                        ecartes en silence. */
                     'kidd', 'wangzhi', 'levent', 'caesar', 'sayyida'];

/* ⛔ LA LISTE DE SECOURS DONNAIT UN SEUIL DE ZERO A TOUT LE MONDE. Sans reseau,
   `listeCapitaines()` retombe dessus — et dix medaillons s'affichaient alors
   OUVERTS, sans cadenas ni compteur. Le joueur en choisissait un, et le serveur
   le refusait au retour du reseau sans qu'il comprenne pourquoi. Les seuils sont
   des constantes de jeu, pas un secret : les ecrire ici ne cree pas une seconde
   verite, puisque celle du serveur ecrase celle-ci des l'accueil — et que c'est
   `ouvert()` cote serveur qui tranche de toute facon. */
const SEUILS_DE_SECOURS = { read: 0, jack: 25, ching: 100, teach: 150, omalley: 250,
                            bonny: 350, bart: 400, lionne: 450, morgan: 500, levasseur: 550,
                            kidd: 600, wangzhi: 650, levent: 700, caesar: 750, sayyida: 800 };
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
  return CAPTAIN_IDS.map((id) => ({ id, seuil: SEUILS_DE_SECOURS[id] || 0 }));
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
  /* Deux chemins, comme au serveur : les parties jouees OU le palier de
     campagne complet. `S.campCaps` arrive avec le welcome et se rafraichit a
     chaque resultat de campagne. */
  if (Array.isArray(S.campCaps) && S.campCaps.includes(id)) return true;
  return parties() >= seuilDe(id);
}

function captainOf(id) {
  return known(id) ? id : DEFAULT_CAPTAIN;
}

export function captainArt(id) {
  return ASSETS + 'img/cap_' + captainOf(id) + '.png';
}

/**
 * LE PORTRAIT DE LA FICHE — le meme dessin, sans son lisere d'autocollant.
 *
 * ⛔ LE MEDAILLON ET LA FICHE NE VEULENT PAS LA MEME IMAGE. Le contour blanc
 * epais de `cap_*.png` est fait pour le petit rond sombre du bandeau : il y
 * detache le visage. Sur la fiche, il colle le personnage PAR-DESSUS le decor au
 * lieu de l'y faire entrer, et la maquette n'en montre aucun.
 *
 * ⚠️ ET CE N'ETAIT PAS RATTRAPABLE EN CSS. Un masque agit sur le cadre de
 * l'image ; le lisere epouse la silhouette. Estomper les bords du rectangle
 * laissait le trait blanc exactement la ou il derangeait — verifie a l'ecran
 * deux fois. L'image de fiche est donc une image a part, produite par
 * `outils/portraits_fiche.py`.
 */
export function portraitFiche(id) {
  return ASSETS + 'img/capf_' + captainOf(id) + '.png';
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

/* ══════════════════════════════════════════════ LA FICHE D'UN CAPITAINE ══
   ⛔ LE BANDEAU NE RACONTAIT RIEN. Dix medaillons, un cadenas, une ligne de
   trait sous la rangee : de quoi CHOISIR, pas de quoi s'attacher. Un capitaine
   qui demande huit cents parties merite qu'on sache qui il est avant de les
   faire — « une fiche avec du lore, ce qu'il offre comme bonus, combien il reste
   pour le debloquer, et si il est debloque un bouton selectionner ».

   ⚠️ RIEN DE CE QUI SUIT N'EST ECRIT DANS CE FICHIER. Le besoin le demande
   explicitement — « les informations ne doivent pas etre ecrites directement
   dans le composant UI » — et la convention existait deja : le SERVEUR envoie
   `{ id, trait, seuil, offre }` dans son message d'accueil, et les TEXTES vivent
   dans les catalogues de traduction, sous des cles derivees de l'identifiant.
   Ajouter un seizieme capitaine ne demande donc pas de toucher a cet ecran : une
   ligne dans `captains.js`, cinq cles dans les quatre catalogues, et il apparait
   avec sa fiche complete.

   La structure conceptuelle du besoin, telle qu'elle existe REELLEMENT ici :

       id              -> la liste du serveur (`S.captains`)
       portrait        -> `cap_<id>.png`         (captainArt)
       name            -> `cap.<id>.name`
       title           -> `cap.<id>.title`
       lore            -> `cap.<id>.lore`
       bonusId         -> `offre` (serveur)
       bonusIcon       -> `trait_<id>.png`       (traitArt)
       bonusName       -> `shop.<bonusId>.name`
       bonusDescription-> `shop.<bonusId>.desc`
       unlockCondition -> `seuil` (serveur), compare a `games`
   ========================================================================= */

/* ⛔ SANS SERVEUR, LA FICHE PERDAIT LA MOITIE DE SON CONTENU. `offre` ne vient
   que du message d'accueil ; la liste de secours, elle, ne porte que `id` et
   `seuil`. Resultat vu a l'ecran : le panneau « BONUS OFFERT » affichait la
   phrase du capitaine a la place du nom et de la description de l'effet, sans
   titre en or — exactement ce que la maquette montre au centre de la fiche.

   C'est la meme situation que les seuils, et la meme reponse : ecrire ici la
   table de secours ne cree pas une seconde verite, puisque celle du serveur
   ecrase celle-ci des l'accueil. Elle vient de `OFFRE_PAR_TRAIT`
   (dice-server/src/game/captains.js) ; Calico Jack n'offre aucun effet — il
   offre un de d'avance — et c'est pourquoi il n'y figure pas. */
const OFFRE_DE_SECOURS = {
  read: 'B001', lionne: 'B004', omalley: 'B005', teach: 'B006', morgan: 'B007',
  bonny: 'B008', bart: 'B009', ching: 'B010', levasseur: 'B011',
  kidd: 'B012', wangzhi: 'B013', levent: 'B014', caesar: 'B015', sayyida: 'B016',
};

/** L'effet offert par ce capitaine : celui du serveur, sinon le notre. */
function offreDe(id) {
  const c = listeCapitaines().find((x) => x.id === id);
  if (c && c.offre) return c.offre;
  return OFFRE_DE_SECOURS[captainOf(id)] || null;
}

/** Un texte de catalogue, ou null si la cle n'existe pas encore. */
function texte(cle) {
  const dit = t(cle);
  return dit && dit !== cle ? dit : null;
}

function ficheCapitaine(id) {
  const seuil = seuilDe(id);
  const jouees = parties();
  const ouvert = capitaineOuvert(id);
  const porte = id === mine();
  const offre = offreDe(id);
  /* La barre ne ment pas : un capitaine offert d'entree (seuil 0) n'a pas de
     progression a montrer, et une barre pleine a 0/0 serait une case cochee
     pour un effort qu'on n'a pas fourni. */
  /* ⛔ « 0 / 0 » N'EST PAS UNE PROGRESSION. Mary Read est offerte d'entree :
     lui dessiner une jauge pleine sur un seuil de zero affiche un chiffre qui ne
     veut rien dire, et coche une case pour un effort que personne n'a fourni.
     La phrase seule suffit — la jauge ne s'affiche qu'a partir du moment ou il
     y a quelque chose a parcourir. */
  const part = seuil > 0 ? Math.min(1, jouees / seuil) : 1;
  /* Le meme texte, deux fois : couche claire (toute la barre) et couche sombre
     (dans le remplissage, decoupee). La largeur de la couche sombre vaut TOUTE
     la barre — 100/part % du remplissage — pour que son centre coincide. */
  const txtJauge = esc(Math.min(jouees, seuil) + ' / ' + seuil);
  const largeurTexte = part > 0 ? Math.round(100 / part) : 100;

  /* ⚠️ LE NOM DE L'EFFET EST EN OR ET SA PHRASE EN BLANC, comme sur la maquette.
     Sans serveur, `offreDe` retombe sur sa table de secours : le panneau garde
     donc son titre et sa description dans tous les cas. La phrase du capitaine
     ne sert plus que de dernier recours, si un jour un capitaine n'offrait
     vraiment rien — c'est le cas de Calico Jack, qui donne un de d'avance. */
  const nomEffet = offre ? texte('shop.' + offre + '.name') : null;
  const ditEffet = offre ? texte('shop.' + offre + '.desc') : null;

  /* ⚠️ TROIS ETATS, TROIS BOUTONS — et pas un bouton dont on changerait le mot.
     Verrouille : il est eteint, et c'est la JAUGE qui dit ce qu'il manque, pas
     le bouton (la maquette garde « Selectionner » en gris). Deja porte : il
     constate. Ouvert : il agit. */
  let action;
  if (!ouvert) {
    action = `<button class="dc-btn dc-capf-choisir" disabled>
                ${esc(t('fiche.choisir'))}</button>`;
  } else if (porte) {
    action = `<button class="dc-btn dc-capf-choisir dc-capf-porte" disabled>
                ${esc(t('fiche.porte'))}</button>`;
  } else {
    action = `<button class="dc-btn dc-capf-choisir" data-choisir="${esc(id)}">
                ${esc(t('fiche.choisir'))}</button>`;
  }

  /* ⛔ LE PORTRAIT RESTE EN COULEUR, MEME VERROUILLE. Je l'avais grise, par
     analogie avec le medaillon du bandeau. La maquette montre l'inverse : Mary
     Read y est en pleine couleur avec une progression de 7/25, donc fermee. Et
     c'est le bon choix — la fiche existe pour DONNER ENVIE du capitaine qu'on
     n'a pas encore ; le peindre en gris fait exactement le contraire. Le
     cadenas, lui, est deja dit trois fois : la jauge, le compte, le bouton
     eteint. */
  return `
    <div class="dc-capf-carte${ouvert ? '' : ' dc-capf-fermee'}">
      <button class="dc-capf-fermer" data-fermer aria-label="${esc(t('hdr.close'))}">
        <img src="${ASSETS}img/icon_close.png" alt="">
      </button>

      <!-- ⛔ LE PORTRAIT EST UNE COUCHE, PAS UNE COLONNE. Je l'avais mis DANS le
           flux, a cote du texte : il poussait la colonne, imposait sa largeur au
           lore, et son fondu ne rencontrait rien — il s'effacait sur du vide au
           lieu de se fondre dans la page.
           Il est desormais empile comme un calque : juste AU-DESSUS du decor et
           du grain, juste EN DESSOUS du texte. C'est ce qui fait la maquette —
           le personnage appartient au fond, et les mots passent par-dessus. Il
           n'a plus de place a occuper, donc plus rien a bousculer, et il peut
           etre cadre librement.
           Il est ecrit AVANT le contenu : a z-index egal, l'ordre du document
           departage, et on ne veut pas dependre de cela. -->
      <img class="dc-capf-portrait" src="${portraitFiche(id)}" alt="">

      <div class="dc-capf-ident">
        <h3>${esc(captainName(id))}</h3>
        <p class="dc-capf-surnom">${esc(texte('cap.' + id + '.title') || '')}</p>
        <span class="dc-capf-filet" aria-hidden="true"></span>
        <p class="dc-capf-lore">${esc(texte('cap.' + id + '.lore') || captainTrait(id))}</p>
      </div>

      <div class="dc-capf-titre">${esc(t('fiche.bonus'))}</div>
      <div class="dc-capf-bonus">
        <img src="${traitArt(id)}" alt="">
        <div>
          ${nomEffet ? `<b>${esc(nomEffet)}</b>` : ''}
          <span>${esc(ditEffet || captainTrait(id))}</span>
        </div>
      </div>

      <div class="dc-capf-titre">${esc(t('fiche.progression'))}</div>
      <div class="dc-capf-progres">
        <span>${esc(ouvert ? t('fiche.acquis') : t('fiche.condition'))}</span>
        ${seuil > 0 ? `
        <div class="dc-capf-jauge" role="progressbar"
             aria-valuenow="${Math.min(jouees, seuil)}" aria-valuemin="0" aria-valuemax="${seuil}">
          <b>${txtJauge}</b>
          <i style="width:${Math.round(part * 100)}%"><span style="width:${largeurTexte}%">${txtJauge}</span></i>
        </div>` : ''}
      </div>

      ${action}
    </div>`;
}

/**
 * Ouvrir la fiche. Elle se ferme au voile, a la croix et au bouton RETOUR.
 *
 * ⚠️ LE BOUTON RETOUR D'ANDROID FERME LA FICHE, IL NE QUITTE PAS LE JEU. C'est
 * la meme regle que pour `uiConfirm`, et l'oublier ici aurait renvoye le joueur
 * au bureau parce qu'il voulait revenir au bandeau.
 */
export function ouvrirFiche(id) {
  const back = document.createElement('div');
  back.className = 'pd-ask dc-capf';
  (document.getElementById('dicewrap') || document.body).appendChild(back);

  /* Le capitaine actuellement montre. Il change au glissement, sans jamais
     refermer la feuille : c'est ce qui fait qu'on FEUILLETTE au lieu d'ouvrir et
     de refermer quinze fois. */
  let courant = captainOf(id);

  const fermer = () => {
    back.remove();
    document.removeEventListener('pd-back', surRetour);
  };
  const surRetour = (ev) => { ev.preventDefault(); fermer(); };

  /**
   * Peindre la fiche d'un capitaine et rebrancher ses boutons.
   *
   * ⚠️ ON REPEINT LE DEDANS, PAS LA FEUILLE. Refaire tout le voile ferait
   * clignoter l'arriere-plan flou et rejouerait son animation d'entree a chaque
   * glissement — on aurait l'impression de rouvrir la fiche, pas de tourner une
   * page.
   */
  const peindre = (quel, sens) => {
    courant = quel;
    back.innerHTML = ficheCapitaine(quel);
    back.querySelector('[data-fermer]').onclick = fermer;
    const choisir = back.querySelector('[data-choisir]');
    if (choisir) {
      choisir.onclick = () => { adopter(choisir.dataset.choisir); fermer(); };
    }
    const carte = back.querySelector('.dc-capf-carte');
    if (carte && sens) {
      /* Le sens du glissement se voit : la carte entre par le cote d'ou elle
         vient. Sans cela, deux capitaines qui se ressemblent donnent
         l'impression que rien ne s'est passe. */
      carte.classList.add(sens > 0 ? 'dc-capf-vient-d' : 'dc-capf-vient-g');
    }
  };

  /**
   * FEUILLETER LES CAPITAINES AU DOIGT.
   *
   * ⚠️ ON S'ARRETE AUX EXTREMITES, ON NE BOUCLE PAS. La rangee des medaillons se
   * lit comme un chemin — le premier est a tout le monde, le dernier se merite —
   * et une liste qui repart au debut efface cette lecture. Arrive au bout, la
   * fiche ne bouge plus ; c'est l'information qu'on est au bout.
   */
  const aller = (pas) => {
    const liste = listeCapitaines().map((c) => c.id);
    const i = liste.indexOf(courant);
    if (i < 0) return;
    const j = i + pas;
    if (j < 0 || j >= liste.length) return;
    peindre(liste[j], pas);
    if (S.sfx) S.sfx.play('open', 0.12);
  };

  /* ⛔ LE GLISSEMENT NE DOIT PAS VOLER LE DEFILEMENT. La fiche defile
     verticalement quand elle est plus haute que l'ecran : un geste vertical doit
     lui rester. On n'agit donc que si le mouvement est franchement HORIZONTAL —
     plus de 44 px, et une fois et demie plus large que haut. En dessous, on ne
     fait rien du tout et le navigateur garde la main. */
  const SEUIL = 44;
  let x0 = 0;
  let y0 = 0;
  let suit = false;
  back.addEventListener('touchstart', (ev) => {
    if (ev.touches.length !== 1) { suit = false; return; }
    x0 = ev.touches[0].clientX;
    y0 = ev.touches[0].clientY;
    suit = true;
  }, { passive: true });
  back.addEventListener('touchend', (ev) => {
    if (!suit) return;
    suit = false;
    const t = ev.changedTouches && ev.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (Math.abs(dx) < SEUIL || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    /* Glisser vers la GAUCHE amene le SUIVANT : c'est le sens d'un jeu de
       cartes qu'on pousse de cote, et celui de tous les carrousels. */
    aller(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* Le clavier fait la meme chose, pour qui joue au navigateur. */
  back.tabIndex = -1;
  back.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') { ev.preventDefault(); aller(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); aller(-1); }
  });

  peindre(courant, 0);
  back.onclick = (ev) => { if (ev.target === back) fermer(); };
  document.addEventListener('pd-back', surRetour);
  requestAnimationFrame(() => { back.classList.add('on'); back.focus(); });
  if (S.sfx) S.sfx.play('open', 0.16);
}

/**
 * Porter ce capitaine.
 *
 * ⚠️ ON PEINT AVANT D'ENVOYER, comme le bandeau le faisait deja : attendre la
 * reponse du serveur pour allumer le medaillon donnerait un ecran qui hesite. Le
 * serveur reste le seul a decider — s'il refuse, son message `me` repassera par
 * `repeindreCapitaines` et remettra la verite.
 */
function adopter(id) {
  if (!capitaineOuvert(id)) return;
  if (S.me) S.me.captain = id;
  repeindreCapitaines();
  if (S.sfx) S.sfx.play('open', 0.16);
  if (S.net) S.net.send({ t: 'captain', captain: id });
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

/* Le temps a tenir pour ouvrir la fiche. Assez long pour distinguer un vrai
   maintien d'un clic, assez court pour ne pas faire attendre. Le loader du
   medaillon (CSS `.dc-cap-hold`) se remplit sur cette meme duree. */
const CAP_HOLD_MS = 480;

function wireCaptains(el) {
  el.querySelectorAll('[data-cap]').forEach((b) => {
    const id = b.dataset.cap;
    const ferme = b.dataset.ferme === '1';
    let timer = 0;
    let ouvertParMaintien = false;

    const apercu = () => { const carte = $('#dc-cap-card'); if (carte) carte.innerHTML = captainCard(id); };

    /* ⛔ UN CLIC COURT CHOISIT, UN MAINTIEN OUVRE LA FICHE. « Pour voir les
       details on reste clique longtemps, un loader charge jusqu'a la modale ;
       pour changer vite de capitaine, on clique une seule fois au lieu d'ouvrir
       la fiche a chaque fois. » Avec quinze medaillons, changer de capitaine est
       le geste le plus frequent : il doit couter UN clic. Le detail, lui, se
       merite d'un maintien — et le loader dit qu'il arrive. */
    const demarrer = (ev) => {
      if (ev && ev.pointerType === 'mouse' && ev.button !== 0) return;
      ouvertParMaintien = false;
      b.classList.add('dc-cap-hold');
      timer = setTimeout(() => {
        timer = 0;
        ouvertParMaintien = true;
        b.classList.remove('dc-cap-hold');
        if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) { /* rien */ } }
        apercu();
        ouvrirFiche(id);
      }, CAP_HOLD_MS);
    };
    const annuler = () => {
      if (timer) { clearTimeout(timer); timer = 0; }
      b.classList.remove('dc-cap-hold');
    };
    const relacher = () => {
      const enCharge = !!timer;
      annuler();
      if (ouvertParMaintien) return;          // la fiche s'est deja ouverte
      if (!enCharge) return;                  // relache hors du medaillon : rien
      /* Clic court : on choisit tout de suite si le capitaine est debloque ;
         sinon on ouvre sa fiche, la seule chose qu'il puisse offrir. */
      /* ⛔ UN CLIC COURT N'OUVRE PLUS LA FICHE — MEME VERROUILLE. « On est cense
         rester appuye longtemps pour ouvrir les details. » Le clic court met le
         capitaine en avant (apercu) et, s'il est debloque, l'adopte. La fiche ne
         s'ouvre qu'au maintien (CAP_HOLD_MS), jamais au tap. */
      apercu();
      if (!ferme) adopter(id);
    };

    b.onpointerdown = demarrer;
    b.onpointerup = relacher;
    b.onpointerleave = annuler;
    b.onpointercancel = annuler;
    /* On neutralise le clic fantome : tout passe par les evenements pointeur. */
    b.onclick = (ev) => { ev.preventDefault(); };
    b.oncontextmenu = (ev) => ev.preventDefault();
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

/**
 * REPEINDRE CE QUI DEPEND DU RESEAU, ET RIEN D'AUTRE.
 *
 * ⛔ CHAQUE BATTEMENT DE LA RELANCE REFAISAIT LE PONT ENTIER. `showMenu()`
 * reconstruit la carte : le titre, le texte, dix medaillons, la fiche du
 * capitaine, trois boutons. La relance automatique bat toutes les une a quinze
 * secondes, et la coupure ou le retour du reseau la declenchent aussi : a chaque
 * fois, tout l'ecran repartait de zero. Un clignotement, la fiche du capitaine
 * qui se referme, le medaillon qu'on etait en train de choisir qui perd sa
 * lumiere — pour trois choses qui, elles, avaient vraiment change.
 * « Il faut pas que ça recharge à chaque détection du serveur ; l'affichage ne
 * change que là où il doit changer. »
 *
 * Trois choses dependent du reseau sur ce pont : le bandeau, et l'etat des deux
 * boutons qui demandent quelqu'un en face. On ne touche qu'elles.
 *
 * Rend `false` si le pont n'est pas encore construit — l'appelant sait alors
 * qu'il faut le dessiner pour de bon.
 */
export function peindreReseau() {
  /* ⚠️ LA BARRE DU BAS SE REPEINT ICI, ET PAS A COTE. Elle vivait dans une
     seconde fonction, dans le shell, qu'il fallait penser a appeler juste apres
     celle-ci — trois appelants, trois occasions de l'oublier, et des onglets
     restes gris apres le retour du reseau. Deux gestes qui doivent toujours
     aller ensemble n'en font qu'un.
     Elle passe par le registre `UI` parce que la barre appartient au shell, et
     que l'importer d'ici ferait un cercle : dice.js importe deja ce module. */
  if (UI.peindreOnglets) UI.peindreOnglets();

  const carte = document.querySelector('#dicewrap .dc-menu-card');
  if (!carte) return false;
  const horsLigne = !S.net || !S.net.ready;

  for (const id of ['dc-multi', 'dc-friend']) {
    const b = document.getElementById(id);
    if (!b) continue;
    b.disabled = horsLigne;
    if (horsLigne) b.setAttribute('title', t('offline.besoinReseau'));
    else b.removeAttribute('title');
  }

  let bandeau = carte.querySelector('.dc-hors-ligne');
  if (!horsLigne) { if (bandeau) bandeau.remove(); return true; }
  if (!bandeau) {
    bandeau = document.createElement('div');
    bandeau.className = 'dc-hors-ligne';
    /* A sa place exacte — juste avant les capitaines — sinon un bandeau pose a
       la fin retomberait sous le pli, ce qu'on vient de corriger. */
    carte.insertBefore(bandeau, carte.querySelector('.dc-caps'));
  }
  const texte = jetons().length
    ? t('offline.bandeau', { n: jetons().length })
    : t('offline.bandeauSeul');
  if (bandeau.textContent !== texte) bandeau.textContent = texte;
  return true;
}

export function renderMenu(el) {
  /* ⚠️ DEUX BOUTONS DEMANDENT QUELQU'UN EN FACE, ET ILS DOIVENT LE DIRE AVANT
     QU'ON APPUIE. Sans reseau, ils repondaient par un bandeau d'avertissement —
     c'est-a-dire apres le geste. Desactives et gris, ils se lisent d'un coup
     d'oeil, et affronter l'IA reste offert : c'est le mode qui tourne sur le
     telephone.

     ⛔ ET ELLE SE DECLARE ICI, PAS DANS UNE BRANCHE. Posee au milieu de la
     fonction, elle n'existait que pour la file d'attente : la branche qui
     dessine les trois boutons levait une ReferenceError, `renderMenu` sortait
     avant d'ecrire quoi que ce soit, et le pont s'affichait VIDE. Une erreur de
     rendu ne casse pas la page — elle la laisse blanche, ce qui est pire, parce
     que rien ne dit ou regarder. */
  const horsLigne = !S.net || !S.net.ready;
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
    $('#dc-unqueue').onclick = () => {
      arreterAttente();
      /* ⛔ CET ECRAN SURVIT A LA COUPURE : S.net peut etre null. Un clic sur
         Annuler plantait alors en silence et l'ecran restait fige. */
      if (S.net && S.net.ready) S.net.send({ t: 'cancel' });
      else if (UI.showMenu) UI.showMenu();
    };
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
    <div class="dc-menu"><div class="dc-menu-card pd-panel dc-menu-pont">
      <!-- ⛔ LES TROIS MODES SORTENT DU DEFILEMENT. Poses a la fin du contenu,
           ils descendaient bien au bas de la carte — et ils en sortaient : des
           que le bandeau des capitaines fait trois rangees, le contenu depasse
           la hauteur de la carte, la marge automatique retombe a zero, et les
           boutons se retrouvent sous le pli, coupes en deux par le bord.
           Or ce sont les SEULES actions de l'ecran : elles ne peuvent pas
           dependre d'un defilement. La carte se coupe donc en deux — une zone
           qui defile, et un pied qui ne bouge jamais. C'est la meme regle que la
           barre du bas de l'application. -->
      <div class="dc-menu-defile">
      <h2>${esc(t('menu.title'))}</h2>
      <p>${esc(t('menu.pitch'))}</p>
      ${(!S.net || !S.net.ready)
        /* ⛔ IL ETAIT SOUS LE PLI, DONC IL N'EXISTAIT PAS. Range apres les trois
           boutons, le bandeau tombait a 762-816 px sur un ecran de 844 dont la
           carte s'arrete a 762 : mesure au banc, INVISIBLE sans faire defiler. Un
           avertissement qu'il faut chercher n'avertit personne — et celui-la est
           la seule chose qui explique pourquoi deux boutons sont gris.

           ⚠️ « IL RESTE 0 PARTIES » N'EST PAS UNE INFORMATION, C'EST UNE PANNE
           MAL DITE. Sans jeton en cale, le bandeau annoncait un compte a zero ; il
           faut lui dire le geste qui remet des parties dans sa poche. */
        ? `<div class="dc-hors-ligne">${esc(jetons().length
            ? t('offline.bandeau', { n: jetons().length })
            : t('offline.bandeauSeul'))}</div>`
        : ''}
      ${captainStrip()}
      </div>

      <!-- ⛔ TROIS BARRES EMPILEES SONT DEVENUES TROIS CARTES COTE A COTE.
           C'est la disposition demandee, maquette a l'appui (home_btn_need.png).
           L'ancienne rangeait les trois modes en colonne sur telephone
           (mobile.css : flex-direction column), avec un dessin qui debordait
           alternativement a gauche et a droite : lisible, mais elle mangeait
           trois hauteurs de bouton dans une carte qui defile deja, et les trois
           modes se lisaient comme une LISTE — donc comme un ordre de preference.

           Cote a cote, ils redeviennent un CHOIX : meme largeur, meme poids,
           trois couleurs qui les distinguent. Le dessin passe au-dessus du
           libelle et deborde vers le HAUT plutot que sur le cote — c'est la
           seule direction ou il reste de la place quand un bouton fait le tiers
           de la largeur.

           ⚠️ RIEN D'AUTRE NE CHANGE. Memes identifiants (dc-solo, dc-multi,
           dc-friend), memes gestionnaires, memes etats desactives avec la
           meme raison en infobulle, meme comportement hors ligne. Seule la
           disposition bouge — c'est ce qui a ete demande, et rien de plus. -->
      <div class="dc-menu-btns dc-menu-trio">
        <button class="dc-btn dc-carte-mode dc-carte-solo" id="dc-solo">
          <img src="${ASSETS}img/menu_ai.png" alt="">
          <span>${esc(t('menu.solo'))}</span></button>
        <!-- ⛔ LA CAMPAGNE EST LA QUATRIEME CARTE, pas un onglet : c'est une
             facon de JOUER, elle vit avec les trois autres. Elle demande le
             reseau pour l'instant (les etoiles se calculent au solde, cote
             serveur) ; la version de poche viendra par le meme chemin que
             l'IA hors ligne. -->
        <button class="dc-btn dc-carte-mode dc-carte-campagne" id="dc-campagne"
                ${horsLigne ? 'disabled title="' + esc(t('offline.besoinReseau')) + '"' : ''}>
          <img src="${ASSETS}img/mode_campagne.png" alt=""
               onerror="this.onerror=null;this.src='${ASSETS}img/menu_ai.png'">
          <span>${esc(t('menu.campagne'))}</span></button>
        <button class="dc-btn dc-carte-mode dc-carte-multi" id="dc-multi"
                ${horsLigne ? 'disabled title="' + esc(t('offline.besoinReseau')) + '"' : ''}>
          <img src="${ASSETS}img/menu_versus.png" alt="">
          <span>${esc(t('menu.multi'))}</span></button>
        <button class="dc-btn dc-carte-mode dc-carte-ami" id="dc-friend"
                ${horsLigne ? 'disabled title="' + esc(t('offline.besoinReseau')) + '"' : ''}>
          <img src="${ASSETS}img/menu_friend.png" alt="">
          <span>${esc(t('menu.friend'))}</span></button>
      </div>
      <!-- ⛔ LA RANGEE « PARTIES / CLASSEMENT / PIECES » A ETE RETIREE.
           Trois nombres au bas de la carte d'accueil, et les trois se lisaient
           deja ailleurs : les pieces et la monnaie maudite sont sur les plaques
           de la barre du haut, le classement sur la plaque « RANG » juste a
           cote. Seul le compte de parties etait unique — et il ne sert qu'a
           deverrouiller des capitaines, ce que les cadenas disent mieux, avec
           le seuil ecrit dessus.
           Repeter une information ne la rend pas plus visible : elle rend la
           carte plus longue, et la carte defile deja sur les petits ecrans. -->
    </div></div>`;

  wireCaptains(el);
  /* ⚠️ LE MEME BOUTON, RESEAU OU PAS. « Affronter l'IA » ne doit pas se
     dedoubler en « en ligne » et « hors ligne » : le joueur ne veut pas choisir
     un mode de transport, il veut jouer. Si la liaison est la, on demande au
     serveur ; sinon on joue sur le telephone avec un jeton, et la partie
     rejoindra le serveur toute seule au retour. */
  $('#dc-solo').onclick = () => {
    S.sfx.play('start', 0.25);
    if (S.net && S.net.ready) { S.net.send({ t: 'play', mode: 'solo' }); return; }
    if (UI.jouerHorsLigne) UI.jouerHorsLigne();
  };
  $('#dc-campagne').onclick = () => {
    if (!S.net || !S.net.ready) { toast(t('offline.besoinReseau'), 'warn'); return; }
    S.sfx.play('open', 0.16);
    if (UI.openPage) UI.openPage('campagne');
  };
  $('#dc-multi').onclick = () => {
    /* ⛔ ET LES DEUX AUTRES MODES DEMANDENT QUELQU'UN EN FACE. Sans reseau, on le
       DIT plutot que de laisser un bouton tourner dans le vide. */
    if (!S.net || !S.net.ready) { toast(t('offline.besoinReseau'), 'warn'); return; }
    S.net.send({ t: 'play', mode: 'multi' });
  };
  $('#dc-friend').onclick = () => {
    if (!S.net || !S.net.ready) { toast(t('offline.besoinReseau'), 'warn'); return; }
    lobby = 'guest'; renderMenu(el);
  };
}

/* ─────────────────────────────────────────────────────── le salon prive ──── */

function renderRoom(el) {
  const attente = lobby === 'host';
  el.innerHTML = `
    <div class="dc-menu"><div class="dc-menu-card pd-panel dc-room">
      <h3>${esc(t(attente ? 'room.waiting' : 'room.title'))}</h3>
      ${attente ? `
        <p>${esc(t('room.share'))}</p>
        <div class="dc-room-ligne">
          <div class="dc-room-code" id="dc-room-code">${esc(hostCode)}</div>
          <button class="dc-btn dc-btn-art dc-room-publier" id="dc-room-publier"
                  title="${esc(t('room.publier'))}" aria-label="${esc(t('room.publier'))}"
          ><img src="${ASSETS}img/icon_link.png" alt="">${esc(t('room.publier'))}</button>
        </div>
        <img class="dc-wheel" src="${ASSETS}img/icon_loader.png" alt="">
        <p class="dc-dim">${esc(t('room.expires'))}</p>
      ` : `
        <p>${esc(t('room.hint'))}</p>
        <div class="dc-room-join">
          <input id="dc-room-input" class="dc-room-input" maxlength="5" autocomplete="off"
                 spellcheck="false" inputmode="text" placeholder="${esc(t('room.placeholder'))}"
                 aria-label="${esc(t('room.placeholder'))}">
          <button class="dc-btn dc-btn-art dc-btn-gros" id="dc-room-go">
            ${esc(t('room.join'))}<img src="${ASSETS}img/icon_join.png" alt=""></button>
        </div>
        <p class="dc-room-or">${esc(t('room.or'))}</p>
        <button class="dc-btn dc-btn-alt dc-btn-art dc-btn-gros" id="dc-room-create">
          ${esc(t('room.create'))}<img src="${ASSETS}img/icon_table.png" alt=""></button>
      `}
      <!-- ⚠️ « ANNULER » N'A PAS D'ICONE, ET C'EST VOULU. Les deux boutons qui
           AGISSENT en portent une, grosse et cernee de blanc ; celui qui renonce
           n'a rien a montrer. Une icone sur les trois les mettait sur le meme
           plan, alors que deux ouvrent une partie et le troisieme referme. -->
      <button class="dc-btn dc-btn-ghost" id="dc-room-back">${esc(t('menu.cancel'))}</button>
    </div></div>`;

  const back = $('#dc-room-back');
  back.onclick = () => {
    if (attente && S.net) S.net.send({ t: 'room', action: 'cancel' });
    lobby = null; hostCode = ''; S.salon = null;
    renderMenu(el);
  };
  if (attente) {
    const code = $('#dc-room-code');
    code.onclick = () => copyCode(hostCode);
    $('#dc-room-publier').onclick = () => publierSalon(hostCode);
    return;
  }

  const input = $('#dc-room-input');
  const go = () => {
    const code = (input.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { toast(t('room.badCode'), 'warn'); return; }
    if (!S.net || !S.net.ready) { toast(t('offline.besoinReseau'), 'warn'); return; }
    S.net.send({ t: 'room', action: 'join', code });
  };
  /* Le code se dicte en majuscules : on ne demande pas au joueur d'y penser. */
  input.oninput = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  input.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } };
  $('#dc-room-go').onclick = go;
  $('#dc-room-create').onclick = () => {
    if (!S.net || !S.net.ready) { toast(t('offline.besoinReseau'), 'warn'); return; }
    S.net.send({ t: 'room', action: 'create' });
  };
  setTimeout(() => { try { input.focus(); } catch (_) { /* pas de clavier */ } }, 60);
}

/**
 * PUBLIER LE SALON : un lien qu'on touche, et un code qu'on peut dicter.
 *
 * ⚠️ DEUX ADRESSES DANS LE MEME MESSAGE, ET CHACUNE POUR UNE RAISON.
 *
 *   Le lien `https://` est celui qu'on ENVOIE : les messageries ne rendent
 *   cliquable qu'un lien web. Un `piratesdice://` colle dans une conversation
 *   reste du texte mort chez la plupart d'entre elles — l'ami verrait une ligne
 *   bizarre et devrait la recopier a la main, ce qui est exactement ce qu'on
 *   voulait lui epargner.
 *
 *   La page derriere ce lien rebondit vers `piratesdice://rejoindre?code=…`,
 *   qui ouvre le jeu directement. Si le jeu n'est pas installe, elle montre les
 *   boutiques — un lien d'invitation est aussi une invitation a installer.
 *
 * ⛔ ET LE CODE RESTE ECRIT EN CLAIR DANS LE MESSAGE. Le lien peut echouer : jeu
 * absent, navigateur qui bloque le rebond, lien tronque par une application.
 * Le code, lui, se lit a voix haute et se tape. On ne remplace pas un chemin
 * qui marche toujours par un chemin qui marche presque toujours ; on ajoute le
 * second au premier.
 */
const SITE = 'https://usernabil.github.io/piratesdice-site';

export function lienDeSalon(code) {
  return SITE + '/rejoindre.html?code=' + encodeURIComponent(code);
}

async function publierSalon(code) {
  if (!code) return;
  const texte = t('room.invitation', { code });
  const lien = lienDeSalon(code);
  const partage = window.Capacitor && window.Capacitor.Plugins
    && window.Capacitor.Plugins.Share;
  if (partage) {
    try {
      await partage.share({ title: t('room.title'), text: texte, url: lien,
                            dialogTitle: t('room.publier') });
      return;
    } catch (e) {
      /* ⚠️ ANNULER N'EST PAS ECHOUER. Refermer la feuille de partage leve la
         meme exception qu'une panne : recopier alors dans le presse-papier
         afficherait « lien copie » a quelqu'un qui vient de dire non. */
      const dit = String((e && e.message) || '').toLowerCase();
      if (dit.includes('cancel') || dit.includes('annul') || dit.includes('abort')) return;
    }
  }
  /* Hors application — ou greffon absent : le lien part au presse-papier. */
  if (!navigator.clipboard) { toast(texte, 'ok'); return; }
  navigator.clipboard.writeText(texte + ' ' + lien)
    .then(() => toast(t('room.lienCopie'), 'ok'))
    .catch(() => toast(texte, 'ok'));
}

/**
 * Rejoindre depuis un lien : `piratesdice://rejoindre?code=XXXXX`.
 *
 * ⚠️ ON N'ENTRE PAS DANS UNE TABLE PENDANT QU'ON JOUE. Le lien peut arriver a
 * n'importe quel moment — l'application est peut-etre au milieu d'une partie.
 * Quitter une partie en cours parce qu'un ami a envoye un lien serait un
 * forfait involontaire, avec sa perte de classement.
 */
let salonAttendu = '';

export function rejoindreParLien(code) {
  const propre = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (propre.length !== 5) return false;
  if (S.state) { toast(t('room.pasPendant'), 'warn'); return false; }
  /* ⛔ AU LANCEMENT A FROID, LE LIEN ARRIVE AVANT LA SOCKET. Toucher le lien
     alors que le jeu est ferme le DEMARRE : l'adresse est deja la quand le
     premier ecouteur se pose, des secondes avant que le serveur ait dit
     bonjour. Envoyer tout de suite ne ferait rien du tout — et l'ami resterait
     devant un menu, sans savoir que son invitation a ete perdue en chemin. On
     la met de cote, et `welcome` la reprend. */
  if (!S.net || !S.net.ready) { salonAttendu = propre; return false; }
  S.net.send({ t: 'room', action: 'join', code: propre });
  return true;
}

/** Le serveur vient de dire bonjour : l'invitation mise de cote peut partir. */
export function reprendreLienEnAttente() {
  if (!salonAttendu) return;
  const code = salonAttendu;
  salonAttendu = '';
  rejoindreParLien(code);
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
  /* Le salon reste ouvert apres la partie : on retient son code pour que la
     carte de fin puisse proposer de rejouer avec le meme ami. */
  S.salon = hostCode ? { code: hostCode } : null;
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
