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
                     'bonny', 'bart', 'lionne', 'morgan', 'levasseur'];

/* ⛔ LA LISTE DE SECOURS DONNAIT UN SEUIL DE ZERO A TOUT LE MONDE. Sans reseau,
   `listeCapitaines()` retombe dessus — et dix medaillons s'affichaient alors
   OUVERTS, sans cadenas ni compteur. Le joueur en choisissait un, et le serveur
   le refusait au retour du reseau sans qu'il comprenne pourquoi. Les seuils sont
   des constantes de jeu, pas un secret : les ecrire ici ne cree pas une seconde
   verite, puisque celle du serveur ecrase celle-ci des l'accueil — et que c'est
   `ouvert()` cote serveur qui tranche de toute facon. */
const SEUILS_DE_SECOURS = { read: 0, jack: 25, ching: 100, teach: 150, omalley: 250,
                            bonny: 350, bart: 400, lionne: 450, morgan: 500, levasseur: 550 };
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
  return parties() >= seuilDe(id);
}

function captainOf(id) {
  return known(id) ? id : DEFAULT_CAPTAIN;
}

export function captainArt(id) {
  return ASSETS + 'img/cap_' + captainOf(id) + '.png';
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

function wireCaptains(el) {
  el.querySelectorAll('[data-cap]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.cap;
      /* ⛔ ON NE POUVAIT PAS REVENIR SUR SON PROPRE CAPITAINE. Le clic sortait
         des que l'identifiant ne changeait pas — une economie qui avait du sens
         quand un clic ne faisait QUE choisir. Mais depuis qu'un capitaine FERME
         presente sa carte sans etre adopte, la carte peut montrer quelqu'un
         d'autre que le capitaine porte : on regarde Barbe-Noire, on retouche
         Mary Read pour relire son trait, et rien ne bouge. « Je ne peux pas
         recliquer sur mon capitaine courant pour afficher son bonus. »
         Toucher son propre capitaine REMONTRE donc sa carte ; ce qu'on epargne,
         c'est l'aller-retour avec le serveur, pas l'affichage. */
      if (id === mine()) {
        const sienne = $('#dc-cap-card');
        if (sienne) sienne.innerHTML = captainCard(id);
        el.querySelectorAll('[data-cap]').forEach((o) => {
          o.classList.toggle('on', o === b);
          o.setAttribute('aria-pressed', String(o === b));
        });
        if (S.sfx) S.sfx.play('open', 0.16);
        return;
      }
      /* ⚠️ UN CAPITAINE FERME SE PRESENTE QUAND MEME. Le clic ne le choisit
         pas, mais il montre sa carte : voir le trait qu'on n'a pas encore est
         ce qui donne envie de le gagner. Un bouton totalement mort
         n'apprendrait rien a personne. */
      if (b.dataset.ferme === '1') {
        const card = $('#dc-cap-card');
        if (card) card.innerHTML = captainCard(id);
        if (S.sfx) S.sfx.play('shut', 0.2);
        toast(t('cap.locked', { n: Math.max(0, seuilDe(id) - parties()) }), 'warn');
        return;
      }
      /* On peint tout de suite et on envoie : attendre la reponse du serveur
         pour allumer le medaillon donnerait un ecran qui hesite. La reponse
         `me` repassera par la et confirmera. */
      if (S.me) S.me.captain = id;
      el.querySelectorAll('[data-cap]').forEach((o) => {
        o.classList.toggle('on', o === b);
        o.setAttribute('aria-pressed', String(o === b));
      });
      const card = $('#dc-cap-card');
      if (card) card.innerHTML = captainCard(id);
      if (S.sfx) S.sfx.play('open', 0.16);
      if (S.net) S.net.send({ t: 'captain', captain: id });
    };
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
    $('#dc-unqueue').onclick = () => { arreterAttente(); S.net.send({ t: 'cancel' }); };
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
    <div class="dc-menu"><div class="dc-menu-card pd-panel">
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
      <!-- LES DESSINS SORTENT DU CADRE, ET ILS ALTERNENT.
           Enfermes dans le bouton, ils valaient 1,9 fois la hauteur du texte —
           trois vignettes en file indienne, illisibles, et le bouton n'etait
           qu'une barre de plus. Poses A CHEVAL sur le bord, ils reprennent la
           taille d'une illustration et donnent au menu son relief.
           L'alternance gauche / droite / gauche est ce que l'admin a demande :
           l'oeil zigzague au lieu de descendre une colonne, et les trois modes
           cessent de se ressembler. -->
      <div class="dc-menu-btns">
        <button class="dc-btn dc-btn-big dc-btn-art dc-btn-deborde dc-btn-deborde-g" id="dc-solo">
          <img src="${ASSETS}img/menu_ai.png" alt="">${esc(t('menu.solo'))}</button>
        <button class="dc-btn dc-btn-big dc-btn-alt dc-btn-art dc-btn-deborde dc-btn-deborde-d" id="dc-multi"
                ${horsLigne ? 'disabled title="' + esc(t('offline.besoinReseau')) + '"' : ''}>
          <img src="${ASSETS}img/menu_versus.png" alt="">${esc(t('menu.multi'))}</button>
        <button class="dc-btn dc-btn-ghost dc-btn-art dc-btn-deborde dc-btn-deborde-g" id="dc-friend"
                ${horsLigne ? 'disabled title="' + esc(t('offline.besoinReseau')) + '"' : ''}>
          <img src="${ASSETS}img/menu_friend.png" alt="">${esc(t('menu.friend'))}</button>
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
          <button class="dc-btn dc-btn-art" id="dc-room-go">
            <img src="${ASSETS}img/icon_join.png" alt="">${esc(t('room.join'))}</button>
        </div>
        <p class="dc-room-or">${esc(t('room.or'))}</p>
        <button class="dc-btn dc-btn-alt dc-btn-art" id="dc-room-create">
          <img src="${ASSETS}img/icon_table.png" alt="">${esc(t('room.create'))}</button>
      `}
      <button class="dc-btn dc-btn-ghost dc-btn-art" id="dc-room-back">
        <img src="${ASSETS}img/icon_back.png" alt="">${esc(t('menu.cancel'))}</button>
    </div></div>`;

  const back = $('#dc-room-back');
  back.onclick = () => {
    if (attente && S.net) S.net.send({ t: 'room', action: 'cancel' });
    lobby = null; hostCode = '';
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
    S.net.send({ t: 'room', action: 'join', code });
  };
  /* Le code se dicte en majuscules : on ne demande pas au joueur d'y penser. */
  input.oninput = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  input.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); go(); } };
  $('#dc-room-go').onclick = go;
  $('#dc-room-create').onclick = () => S.net.send({ t: 'room', action: 'create' });
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
