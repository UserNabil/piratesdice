/* ============================================================================
   pages/dice_end.js — la carte de fin de partie.

   Sortie de dice_match.js pour la meme raison que les panneaux : la traduction
   a fait deborder le fichier. L'ecran de fin est un morceau autonome — il ne
   dessine rien de la table, il rend le verdict.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { S, UI, ASSETS, fxUrl } from './dice_state.js';
import { captainArt, captainTrait } from './dice_lobby.js';

/* ⛔ L'ECRAN DE MISE A ETE SUPPRIME, ET AVEC LUI TOUT LE PARI.
   Apple refuse automatiquement toute application declarant de la « simulation
   de jeu d'argent » quand elle est publiee par un compte de developpeur
   INDIVIDUEL — et miser une monnaie sur l'issue d'un match entre dans leur
   definition, meme sans argent reel. Le refus tombait avant meme la relecture.

   Les pieces restent : on en gagne en gagnant, on les depense en boutique. Ce
   qui disparait, c'est l'engagement AVANT la partie et le pot que rafle le
   vainqueur. La partie commence maintenant des que les deux sieges sont la.

   Sont partis avec : les jetons de montants prets, le champ libre borne sur la
   bourse, l'attente lue dans l'etat du serveur, et `renderBet`. `dice_match.js`
   ne l'appelle plus et le conteneur `#dc-bet` n'existe plus dans l'arene. */
export function onOver(m) {
  /* ⚠️ CELUI QUI PART A DEJA CHOISI. `requestClose` pose ce drapeau avant
     d'envoyer `leave` : l'annonce de fin qui suit lui est destinee autant qu'a
     l'autre, mais elle n'a plus rien a lui apprendre. On l'avale une fois — et
     une seule, pour que la partie suivante retrouve sa carte de fin. */
  if (S.quitting) { S.quitting = false; return; }
  const el = $('#dc-over');
  const verdict = t(m.outcome === 'win' ? 'over.victory' : (m.outcome === 'loss' ? 'over.defeat' : 'over.draw'));
  const delta = m.ratingAfter - m.ratingBefore;
  const rating = m.rated
    ? `<div class="dc-over-line">${t('over.elo', {
        before: m.ratingBefore, after: '<b>' + m.ratingAfter + '</b>',
        delta: (delta >= 0 ? '+' : '') + delta })}</div>`
    : `<div class="dc-over-line dc-dim">${esc(t('over.notRated'))}</div>`;
  const reason = m.reason === 'disconnect'
    ? `<div class="dc-over-line dc-dim">${esc(t('over.oppDropped'))}</div>`
    : (m.reason === 'quit' ? `<div class="dc-over-line dc-dim">${esc(t('over.someoneLeft'))}</div>` : '');

  const seal = m.outcome === 'win' ? 'seal_victory' : (m.outcome === 'loss' ? 'seal_defeat' : 'seal_draw');
  el.innerHTML = `
    <div class="dc-over-card pd-panel dc-over-${esc(m.outcome)}">
      <img class="dc-over-seal" src="${ASSETS}img/${seal}.png" alt="">
      <h2>${verdict}</h2>
      <div class="dc-over-score">${m.scores[0]} <span>—</span> ${m.scores[1]}</div>
      <div class="dc-over-line dc-over-foe">
        <img class="dc-over-cap" src="${captainArt(m.opponentCaptain)}" alt=""
             title="${esc(captainTrait(m.opponentCaptain))}">
        ${esc(t('over.against', { name: m.opponent }))}
      </div>
      ${rating}
      <div class="dc-over-line">${esc(t('over.coins', { delta: (m.coinDelta >= 0 ? '+' : '') + m.coinDelta }))}
        <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>
      ${reason}
      <div class="dc-over-btns">
        <button class="dc-btn" id="dc-again">${esc(t('over.again'))}</button>
        <button class="dc-btn dc-btn-ghost" id="dc-back">${esc(t('over.back'))}</button>
      </div>
    </div>`;
  el.classList.remove('dc-rain');
  if (m.outcome === 'win') rain(el);
  el.classList.add('on');
  S.sfx.play(m.outcome === 'win' ? 'coin' : 'shut', 0.3);

  const leave = () => { el.classList.remove('on'); S.state = null; S.seat = -1; UI.showMenu(); };
  UI.leaveMatch = leave;                     // la barre laterale s'en sert aussi
  const mode = m.rated ? 'multi' : 'solo';
  $('#dc-again').onclick = () => { leave(); S.net.send({ t: 'play', mode }); };
  $('#dc-back').onclick = leave;
}
