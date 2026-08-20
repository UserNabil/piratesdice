/* ============================================================================
   pages/dice_end.js — la carte de fin de partie.

   Sortie de dice_match.js pour la meme raison que les panneaux : la traduction
   a fait deborder le fichier. L'ecran de fin est un morceau autonome — il ne
   dessine rien de la table, il rend le verdict.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { S, UI, ASSETS, fxUrl } from './dice_state.js';

/*
 * LES MONTANTS PRETS. Sur un telephone, taper un nombre ouvre le clavier, qui
 * recouvre la moitie de l'ecran au moment precis ou le joueur veut juste dire
 * « je mise 50 ». Quatre jetons couvrent tous les cas usuels ; le champ reste
 * la pour qui veut un montant exact.
 */
function betChips(purse) {
  const out = [{ value: 0, label: t('bet.none') }];
  for (const value of [10, 50, 100, 250]) {
    if (value <= purse) out.push({ value, label: String(value) });
  }
  if (purse > 0) out.push({ value: purse, label: t('bet.all') });
  return out;
}

export function renderBet(st, full) {
  const bet = $('#dc-bet');
  if (!bet) return;
  if (st.phase !== 'betting') { bet.classList.remove('on'); return; }
  bet.classList.add('on');

  if (!full && bet.dataset.ready === '1') return;
  bet.dataset.ready = '1';
  const purse = S.me ? S.me.coins : 0;
  bet.innerHTML = `
    <div class="dc-bet-card pd-panel">
      <img class="dc-bet-art" src="${ASSETS}img/ornament_stake.png" alt="">
      <h3>${esc(t('bet.title'))}</h3>
      <p>${esc(t('bet.hint'))}</p>
      <div class="dc-bet-chips">${betChips(purse).map((c) => `
        <button class="dc-chip" data-bet="${c.value}">${esc(c.label)}</button>`).join('')}
      </div>
      <div class="dc-bet-row">
        <input type="number" id="dc-bet-input" min="0" step="10" value="0" max="${purse}" aria-label="stake">
        <span class="dc-bet-max">${esc(t('bet.of', { n: purse }))} <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></span>
      </div>
      <button class="dc-btn" id="dc-bet-go">${esc(t('bet.lock'))}</button>
      <div class="dc-bet-wait"></div>
    </div>`;
  const field = $('#dc-bet-input');
  bet.querySelectorAll('.dc-chip').forEach((chip) => {
    chip.onclick = () => {
      field.value = chip.dataset.bet;
      bet.querySelectorAll('.dc-chip').forEach((c) => c.classList.toggle('on', c === chip));
    };
  });

  $('#dc-bet-go').onclick = () => {
    const value = parseInt($('#dc-bet-input').value, 10);
    S.net.send({ t: 'bet', value: Number.isFinite(value) ? value : 0 });
    $('#dc-bet-go').disabled = true;
    bet.querySelector('.dc-bet-wait').textContent = t('bet.waiting');
  };
}


export function onOver(m) {
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
      <div class="dc-over-line">${esc(t('over.against', { name: m.opponent }))}</div>
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
