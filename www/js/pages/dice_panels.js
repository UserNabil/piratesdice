/* ============================================================================
   pages/dice_panels.js — les trois panneaux du rail : regles, boutique, classement.

   Sortis de dice.js quand la traduction l'a fait passer au-dessus de la limite
   de 400 lignes. Le decoupage suit ce que les morceaux SONT : la coque d'un
   cote, les trois feuilles de l'autre.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/toast.js';
import { S, UI, ASSETS, bonusArt } from './dice_state.js';
import { renderBonusRack } from './dice_match.js';

export function renderRules(body) {
  body.innerHTML = `
    <h3>${esc(t('rules.title'))}</h3>
    <ol class="dc-rules">
      <li>${t('rules.1')}</li>
      <li>${t('rules.2')}</li>
      <li>${t('rules.3')}</li>
      <li>${t('rules.4')}</li>
      <li>${t('rules.5', { n: S.rules.maxBonusPerMatch })}</li>
      <li>${t('rules.6', { n: S.rules.winReward })}</li>
    </ol>
    <p class="dc-dim">${t('rules.shortcuts', {
      space: '<kbd>Space</kbd>', one: '<kbd>1</kbd>', two: '<kbd>2</kbd>',
      three: '<kbd>3</kbd>', esc: '<kbd>Esc</kbd>',
    })}</p>`;
}

export async function renderShop(body) {
  body.innerHTML = '<h3>' + esc(t('shop.title')) + '</h3><div class="dc-loading">'
    + esc(t('shop.opening')) + '</div>';
  let products = S.shop;
  try {
    if (!products.length) products = (await S.net.rest('/api/shop')).products || [];
    S.shop = products;
  } catch (e) {
    body.innerHTML = `<h3>${esc(t('shop.title'))}</h3><p class="dc-err">${esc(e.message)}</p>`;
    return;
  }

  const have = new Map(S.inventory.map((i) => [i.identify, i.quantity]));
  body.innerHTML = `<h3>${esc(t('shop.title'))}</h3>
    <div class="dc-shop">${products.map((p) => `
      <div class="dc-shop-item">
        <img src="${bonusArt(p.identify)}" alt="">
        <div class="dc-shop-txt">
          <b>${esc(p.name)}</b>
          <span>${esc(p.description)}</span>
          <em>${esc(t('shop.owned', { n: have.get(p.identify) || 0 }))}</em>
        </div>
        <button class="dc-btn dc-btn-sm" data-buy="${esc(p.identify)}"
                ${S.me && S.me.coins < p.basic_price ? 'disabled' : ''}>${p.basic_price}
          <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></button>
      </div>`).join('')}</div>`;

  body.querySelectorAll('[data-buy]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try {
        const out = await S.net.rest('/api/purchase', 'POST', { identify: b.dataset.buy, quantity: 1 });
        S.inventory = out.inventory || S.inventory;
        if (S.me) S.me.coins = out.coins;
        S.sfx.play('coin', 0.35);
        toast(t('shop.bought'), 'ok');
        if (UI.renderWallet) UI.renderWallet(); renderBonusRack(); renderShop(body);
      } catch (e) {
        toast(e.message, 'warn');
        b.disabled = false;
      }
    };
  });
}

export async function renderRanking(body) {
  body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3><div class="dc-loading">'
    + esc(t('ladder.reading')) + '</div>';
  try {
    const rows = (await S.net.rest('/api/leaderboard?limit=25')).players || [];
    body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3>' + (rows.length
      ? `<table class="dc-ladder">
          <thead><tr><th>#</th><th>${esc(t('ladder.captain'))}</th><th>${esc(t('ladder.elo'))}</th>
          <th>${esc(t('ladder.w'))}</th><th>${esc(t('ladder.l'))}</th><th>${esc(t('ladder.d'))}</th></tr></thead>
          <tbody>${rows.map((p, i) => `
            <tr class="${S.me && p.pseudo === S.me.pseudo ? 'dc-ladder-me' : ''}">
              <td>${i + 1}</td><td>${esc(p.display_name || p.pseudo)}</td>
              <td><b>${p.rating}</b></td><td>${p.wins}</td><td>${p.losses}</td><td>${p.draws}</td>
            </tr>`).join('')}</tbody></table>`
      : '<p class="dc-dim">' + esc(t('ladder.empty')) + '</p>');
  } catch (e) {
    body.innerHTML = `<h3>${esc(t('ladder.title'))}</h3><p class="dc-err">${esc(e.message)}</p>`;
  }
}
