/* ============================================================================
   pages/dice_fx.js — ce que la partie ANNONCE.

   Le serveur envoie une liste d'effets a chaque coup ; la moitie d'entre eux ne
   se dessinent pas, ils se DISENT : un trait de capitaine qui vient de se
   declencher, une bordee, l'IA qui joue un bonus. Sans un mot, le joueur voit
   des des disparaitre sans savoir pourquoi — et un jeu qu'on ne comprend pas
   n'est pas difficile, il est injuste.

   Tout est ici pour que dice_match.js reste le dessin de la table, et parce que
   ces annonces partagent la meme regle : ne jamais parler deux fois du meme
   evenement, et ne jamais couvrir le plateau.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/toast.js';
import { S } from './dice_state.js';

const BANNIERE_MS = 1500;
let derniere = 0;

/* Une banniere ne se rejoue pas sur elle-meme : deux coups rapproches se
   voleraient l'affichage, et on ne lirait ni l'un ni l'autre. */
function banner(texte, ton) {
  const arene = document.querySelector('#dc-screen-game .dc-arena');
  if (!arene) return;
  const now = Date.now();
  if (now - derniere < 400) return;
  derniere = now;

  const el = document.createElement('div');
  el.className = 'dc-shout' + (ton ? ' dc-shout-' + ton : '');
  el.textContent = texte;
  arene.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, BANNIERE_MS);
}

/** La table tremble : une bordee, ca se sent avant de se lire. */
function shake() {
  const arene = document.querySelector('#dc-screen-game .dc-arena');
  if (!arene) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  arene.classList.remove('dc-shake');
  void arene.offsetWidth;
  arene.classList.add('dc-shake');
  setTimeout(() => arene.classList.remove('dc-shake'), 520);
}

/** La vibration du telephone, quand il en a une. Silencieuse ailleurs. */
function buzz(ms) {
  if (!navigator.vibrate || (S.sfx && S.sfx.muted)) return;
  try { navigator.vibrate(ms); } catch (_) { /* refuse : ce n'est pas grave */ }
}

function nomDuSiege(seat) {
  const p = S.state && S.state.players ? S.state.players[seat] : null;
  return (p && p.name) || t('game.opponent');
}

/**
 * Passe la liste d'effets en revue et dit ce qu'il faut dire.
 * Appele APRES le dessin, pour qu'un mot n'arrive jamais avant son image.
 */
export function announce(fx) {
  for (const f of fx) {
    if (f.kind === 'broadside') {
      banner(t('fx.broadside', { n: f.count }), f.seat === S.seat ? 'good' : 'bad');
      shake();
      buzz(f.seat === S.seat ? [0, 40, 60, 90] : 60);
      continue;
    }

    if (f.kind === 'trait') {
      const nom = t('cap.trait.' + f.trait);
      if (!nom || nom.startsWith('cap.trait.')) continue;
      if (f.seat === S.seat) banner(nom, 'good');
      else toast(t('fx.foeTrait', { name: nomDuSiege(f.seat), trait: nom }), 'warn');
      continue;
    }

    if (f.kind === 'aibonus') {
      toast(t('fx.aiBonus', { name: nomDuSiege(f.seat), bonus: t('shop.' + f.identify + '.name') }), 'warn');
      continue;
    }

    if (f.kind === 'place' && f.seat === S.seat) buzz(18);
  }
}

/* ─────────────────────────────────── ce que Ching Shih voit avant les autres ── */

/**
 * Le prochain de de l'adversaire, montre a cote de sa carte.
 *
 * ⚠️ C'est le SERVEUR qui decide de l'envoyer : `state.foresee` vaut null pour
 * qui n'a pas le trait. Le client ne fait que l'afficher — s'il calculait ce
 * droit lui-meme, il suffirait de le modifier pour tricher.
 */
export function renderForesee(st, dieFace) {
  const carte = $('#dc-pc-foe');
  if (!carte) return;
  const ancien = carte.querySelector('.dc-foresee');
  if (ancien) ancien.remove();
  if (st.foresee === null || st.foresee === undefined || st.phase !== 'playing') return;

  const el = document.createElement('div');
  el.className = 'dc-foresee';
  el.title = t('cap.ching.trait');
  el.innerHTML = '<span class="dc-foresee-lbl">' + esc(t('fx.next')) + '</span>' + dieFace(st.foresee);
  carte.appendChild(el);
}
