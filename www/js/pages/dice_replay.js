/* ============================================================================
   pages/dice_replay.js — LE JOURNAL DE BORD : revoir ses parties.

   ⚠️ ON REVOIT POUR COMPRENDRE, PAS POUR SE REGARDER. Une rediffusion qui
   defile toute seule du debut a la fin ne sert a rien : ce qu'on cherche, c'est
   LE coup ou la partie a bascule. D'ou trois commandes qui comptent plus que le
   reste — pas a pas en arriere, pas a pas en avant, et une vitesse qu'on
   choisit. La lecture automatique n'est qu'un confort par-dessus.

   ⛔ ET LE CLIENT NE RECALCULE RIEN. Les images arrivent du serveur, calculees
   par le moteur qui a arbitre la partie (game/rediffusion.js) : refaire les
   additions ici aurait cree une seconde verite, qui aurait vieilli en silence
   jusqu'au jour ou la rediffusion aurait affiche un score que la partie n'a
   jamais eu.

   ⚠️ LES PARTIES CONTRE LA MACHINE N'Y SONT PAS, C'EST VOULU. Revoir l'IA
   n'apprend rien qu'on ne puisse observer en direct, et cela noierait les vraies
   parties sous les entrainements.
   ============================================================================ */

import { esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/toast.js';
import { S, ASSETS } from './dice_state.js';
import { buildBoard, renderBoard, blastCells } from './dice_board.js';

/* Le temps d'une image a vitesse normale. Assez lent pour suivre un de qui
   tombe, assez vif pour qu'une partie de quarante coups ne dure pas une
   minute. */
const PAS_MS = 850;
const VITESSES = [0.5, 1, 2];

/* L'etat du lecteur. Il vit ici et nulle part ailleurs : la page se referme
   souvent, et un lecteur qui continuerait de tourner derriere un panneau ferme
   jouerait des sons dans le vide. */
let lecteur = null;

function stopper() {
  if (lecteur && lecteur.horloge) { clearInterval(lecteur.horloge); lecteur.horloge = null; }
}

export function fermerLecteur() {
  stopper();
  lecteur = null;
}

/* ─────────────────────────────────────────────────────── l'historique ───── */

function quand(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  /* La date du telephone, dans sa langue : une chaine fabriquee a la main
     serait juste en francais et fausse partout ailleurs. */
  try {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

function ligneHistoire(p) {
  const verdict = p.resultat === 'win' ? 'over.victory'
    : (p.resultat === 'loss' ? 'over.defeat' : 'over.draw');
  const ecart = (p.eloApres !== null && p.eloAvant !== null) ? p.eloApres - p.eloAvant : null;
  return '<li class="dc-hist dc-hist-' + p.resultat + (p.rejouable ? '' : ' dc-hist-vieux') + '"'
    + (p.rejouable ? ' data-rejouer="' + p.id + '"' : '') + '>'
    + '<span class="dc-hist-verdict">' + esc(t(verdict)) + '</span>'
    + '<span class="dc-hist-txt"><b>' + esc(p.adversaire || '?') + '</b>'
    + '<span>' + esc(quand(p.quand)) + '</span></span>'
    + '<span class="dc-hist-score">' + p.score + ' – ' + p.scoreAdverse
    + (ecart === null ? '' : '<em>' + (ecart >= 0 ? '+' : '') + ecart + '</em>') + '</span>'
    + (p.rejouable
        ? '<img class="dc-hist-go" src="' + ASSETS + 'img/icon_replay.png" alt="">'
        : '<span class="dc-hist-vieux-txt">' + esc(t('rep.tropVieux')) + '</span>')
    + '</li>';
}

export function renderReplays(body) {
  if (!S.historique) {
    body.innerHTML = '<h3>' + esc(t('tab.replay')) + '</h3>'
      + '<p class="dc-empty">' + esc(t('ladder.reading')) + '</p>';
    if (S.net) S.net.send({ t: 'historique' });
    return;
  }
  if (!S.historique.length) {
    body.innerHTML = '<h3>' + esc(t('tab.replay')) + '</h3>'
      + '<p class="dc-empty">' + esc(t('rep.vide')) + '</p>';
    return;
  }
  body.innerHTML = '<h3>' + esc(t('tab.replay')) + '</h3>'
    + '<p class="dc-suc-tete">' + esc(t('rep.tete')) + '</p>'
    + '<ul class="dc-hist-liste">' + S.historique.map(ligneHistoire).join('') + '</ul>';

  body.querySelectorAll('[data-rejouer]').forEach((li) => {
    li.onclick = () => {
      if (S.sfx) S.sfx.play('open', 0.2);
      if (S.net) S.net.send({ t: 'rejouer', id: Number(li.dataset.rejouer) });
    };
  });
}

/* ───────────────────────────────────────────────────────── le lecteur ───── */

/** Le serveur a repondu : on monte le lecteur par-dessus le panneau. */
export function ouvrirRejeu(partie) {
  const hote = document.querySelector('#dc-panel .dc-panel-in');
  if (!hote || !partie || !Array.isArray(partie.images) || !partie.images.length) return;
  fermerLecteur();
  lecteur = { partie, i: 0, vitesse: 1, horloge: null, boards: [null, null] };

  const moi = partie.moi === 1 ? 1 : 0;
  const lui = 1 - moi;
  const nom = (s) => (partie.joueurs && partie.joueurs[s] && partie.joueurs[s].nom) || '?';

  hote.innerHTML = '<div class="dc-rep">'
    + '<div class="dc-rep-tete">'
      + '<button class="dc-btn dc-btn-sm dc-btn-ghost" data-rep-retour>'
      + '<img src="' + ASSETS + 'img/icon_back.png" alt="">' + esc(t('rep.retour')) + '</button>'
      + '<b>' + esc(nom(moi)) + ' – ' + esc(nom(lui)) + '</b>'
    + '</div>'
    + '<div class="dc-rep-tables"></div>'
    + '<div class="dc-rep-legende" data-rep-legende></div>'
    + '<input class="dc-rep-piste" type="range" min="0" max="' + (partie.images.length - 1)
      + '" value="0" data-rep-piste aria-label="' + esc(t('rep.coup')) + '">'
    + '<div class="dc-rep-cmd">'
      + '<button class="dc-rep-btn" data-rep="prev" title="' + esc(t('rep.prev')) + '"'
        + ' aria-label="' + esc(t('rep.prev')) + '">◀◀</button>'
      + '<button class="dc-rep-btn dc-rep-jouer" data-rep="play" title="' + esc(t('rep.play')) + '"'
        + ' aria-label="' + esc(t('rep.play')) + '">▶</button>'
      + '<button class="dc-rep-btn" data-rep="next" title="' + esc(t('rep.next')) + '"'
        + ' aria-label="' + esc(t('rep.next')) + '">▶▶</button>'
      + '<span class="dc-rep-vitesses">' + VITESSES.map((v) =>
          '<button class="dc-rep-x' + (v === 1 ? ' on' : '') + '" data-vitesse="' + v + '">×'
          + String(v).replace('.', ',') + '</button>').join('') + '</span>'
    + '</div></div>';

  /* ⚠️ LES MEMES PLATEAUX QUE PENDANT LA PARTIE, ET SURTOUT DANS LE MEME SENS :
     le mien en bas. Rejouer avec les cotes inverses obligerait a se reperer
     avant de comprendre, ce qui est exactement le contraire du but. */
  const tables = hote.querySelector('.dc-rep-tables');
  lecteur.boards[lui] = buildBoard(lui, true);
  lecteur.boards[moi] = buildBoard(moi, false);
  tables.appendChild(lecteur.boards[lui]);
  tables.appendChild(lecteur.boards[moi]);

  hote.querySelector('[data-rep-retour]').onclick = () => {
    fermerLecteur();
    renderReplays(hote);
  };
  hote.querySelector('[data-rep-piste]').oninput = (ev) => {
    stopper();
    peindre(Number(ev.target.value), false);
    majBouton();
  };
  hote.querySelectorAll('[data-rep]').forEach((b) => {
    b.onclick = () => {
      const quoi = b.dataset.rep;
      if (quoi === 'prev') { stopper(); peindre(lecteur.i - 1, false); }
      else if (quoi === 'next') { stopper(); peindre(lecteur.i + 1, false); }
      else basculer();
      majBouton();
    };
  });
  hote.querySelectorAll('[data-vitesse]').forEach((b) => {
    b.onclick = () => {
      lecteur.vitesse = Number(b.dataset.vitesse) || 1;
      hote.querySelectorAll('[data-vitesse]').forEach((o) => o.classList.toggle('on', o === b));
      /* Changer de vitesse pendant la lecture ne l'arrete pas : on repose
         simplement l'horloge sur le nouveau rythme. */
      if (lecteur.horloge) { stopper(); lancer(); }
    };
  });

  peindre(0, false);
}

function image() {
  return lecteur.partie.images[lecteur.i];
}

/**
 * Poser une image.
 *
 * `anime` distingue les deux usages : en lecture, on veut l'explosion des des
 * emportes ; en glissant la piste a la main, on ne veut rien du tout — sinon
 * traverser trente coups declencherait trente explosions en cascade.
 */
function peindre(n, anime) {
  const images = lecteur.partie.images;
  const i = Math.max(0, Math.min(images.length - 1, n));
  const avant = lecteur.i;
  lecteur.i = i;
  const im = images[i];

  for (const s of [0, 1]) {
    const board = lecteur.boards[s];
    if (board) renderBoard(board, im.grids[s], im.colonnes[s]);
  }

  const hote = document.querySelector('#dc-panel .dc-panel-in');
  const piste = hote && hote.querySelector('[data-rep-piste]');
  if (piste && Number(piste.value) !== i) piste.value = String(i);
  const legende = hote && hote.querySelector('[data-rep-legende]');
  if (legende) legende.innerHTML = phrase(im);

  if (anime && i === avant + 1 && im.detruits && im.detruits.length) {
    const board = lecteur.boards[im.victime];
    if (board) blastCells(board, im.detruits);
    if (S.sfx) S.sfx.play('boom', 0.3);
  } else if (anime && i === avant + 1 && im.t === 'pose') {
    if (S.sfx) S.sfx.play('dice', 0.3, 1.28);
  }
}

/**
 * Ce que raconte l'image courante, en une ligne.
 *
 * ⚠️ LE SCORE EST TOUJOURS LA, MEME QUAND IL NE BOUGE PAS. C'est lui qu'on
 * suit du coin de l'oeil en rejouant : le retirer des images « neutres » (un
 * lancer, un tour saute) obligerait a le chercher ailleurs, et on perdrait
 * justement le fil qu'on est venu suivre.
 */
function phrase(im) {
  const p = lecteur.partie;
  const nom = (s) => esc((p.joueurs && p.joueurs[s] && p.joueurs[s].nom) || '?');
  const total = '<span class="dc-rep-pts">' + im.totaux[p.moi] + ' – ' + im.totaux[1 - p.moi] + '</span>';
  const dit = (cle, val) => esc(t(cle, val));

  if (im.t === 'debut') return dit('rep.debut') + total;
  if (im.s === null) return total;
  if (im.t === 'roll') return nom(im.s) + ' ' + dit('rep.roll', { v: im.v }) + total;
  if (im.t === 'pose') {
    const combien = im.detruits ? im.detruits.length : 0;
    return nom(im.s) + ' ' + dit('rep.pose', { v: im.v, col: (im.c || 0) + 1 })
      + (combien ? ' <b class="dc-rep-boum">' + dit('rep.emporte', { n: combien }) + '</b>' : '')
      + total;
  }
  if (im.t === 'effet') {
    /* Les effets portent leur nom dans le catalogue de la boutique : c'est
       la meme chose, et deux listes de six noms auraient diverge. */
    const quoi = im.b ? t('shop.' + im.b + '.name') : '';
    return nom(im.s) + ' ' + dit('rep.effet', { quoi }) + total;
  }
  if (im.t === 'saut') {
    return nom(im.s) + ' ' + dit(im.par === 'gel' ? 'rep.gele' : 'rep.absent') + total;
  }
  return total;
}

function lancer() {
  stopper();
  lecteur.horloge = setInterval(() => {
    if (lecteur.i >= lecteur.partie.images.length - 1) { stopper(); majBouton(); return; }
    peindre(lecteur.i + 1, true);
  }, Math.max(120, Math.round(PAS_MS / lecteur.vitesse)));
}

function basculer() {
  if (lecteur.horloge) { stopper(); return; }
  /* Relancer depuis la fin recommence au debut : sinon le bouton « lecture »
     ne fait rien et parait casse. */
  if (lecteur.i >= lecteur.partie.images.length - 1) peindre(0, false);
  lancer();
}

function majBouton() {
  const b = document.querySelector('.dc-rep-jouer');
  if (!b) return;
  const joue = !!(lecteur && lecteur.horloge);
  b.textContent = joue ? '❚❚' : '▶';
  b.setAttribute('aria-label', t(joue ? 'rep.pause' : 'rep.play'));
  b.setAttribute('title', t(joue ? 'rep.pause' : 'rep.play'));
}
