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

/**
 * Un appel a l'API du jeu, qui ne plante pas quand la socket est tombee.
 *
 * ⚠️ LES TROIS PANNEAUX APPELAIENT `S.net.rest(...)` DIRECTEMENT. Des que la
 * connexion etait fermee — en quittant une partie, par exemple — `S.net` valait
 * null et le simple fait d'ouvrir le classement rendait « cannot read properties
 * of null (reading 'rest') » a la figure du joueur. Un panneau qui ne peut pas
 * charger doit le DIRE, pas casser l'application.
 */
async function api(chemin, methode, corps) {
  if (!S.net || typeof S.net.rest !== 'function') {
    toast(t('connect.outOfReach'), 'warn');
    return null;
  }
  try {
    return await S.net.rest(chemin, methode, corps);
  } catch (e) {
    toast((e && e.message) || t('connect.outOfReach'), 'warn');
    return null;
  }
}

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
      <li>${t('rules.7')}</li>
    </ol>
    <p class="dc-dim dc-keys">${t('rules.shortcuts', {
      space: '<kbd>Space</kbd>', one: '<kbd>1</kbd>', two: '<kbd>2</kbd>',
      three: '<kbd>3</kbd>', esc: '<kbd>Esc</kbd>',
    })}</p>`;
}

/* Le nom et la description des bonus viennent de la BASE, en anglais : le
   serveur ne parle pas la langue du joueur et n'a pas a la connaitre. On les
   traduit donc ici, par identifiant, et on retombe sur le texte du serveur si
   un produit nouveau arrive avant sa traduction — mieux vaut un mot anglais
   qu'une case vide. (Vu a l'ecran le 2026-08-20 : boutique anglaise dans une
   interface francaise.) */
function shopText(identify, part, secours) {
  const key = 'shop.' + identify + '.' + part;
  const texte = t(key);
  return texte === key ? secours : texte;
}

export async function renderShop(body) {
  body.innerHTML = '<h3>' + esc(t('shop.title')) + '</h3><div class="dc-loading">'
    + esc(t('shop.opening')) + '</div>';
  let products = S.shop;
  try {
    if (!products.length) products = ((await api('/api/shop')) || {}).products || [];
    S.shop = products;
  } catch (e) {
    body.innerHTML = `<h3>${esc(t('shop.title'))}</h3><p class="dc-err">${esc(e.message)}</p>`;
    return;
  }

  const have = new Map(S.inventory.map((i) => [i.identify, i.quantity]));
  body.innerHTML = `<h3>${esc(t('shop.title'))}</h3>
    <div class="dc-shop">${products.map((p) => `
      <div class="dc-shop-item">
        <img src="${vignette(p)}" alt="">
        <div class="dc-shop-txt">
          <b>${esc(shopText(p.identify, 'name', p.name))}</b>
          <span>${esc(shopText(p.identify, 'desc', p.description))}</span>
          <em>${esc(estParure(p)
            ? (have.get(p.identify) ? t('skin.owned') : t('skin.appearance'))
            : t('shop.owned', { n: have.get(p.identify) || 0 }))}</em>
        </div>
        ${bouton(p, have)}
      </div>`).join('')}</div>`;

  body.querySelectorAll('[data-skin]').forEach((b) => {
    b.onclick = () => {
      /* Une chaine vide veut dire « retirer » : le serveur remet les des
         d'origine, et n'a donc rien a verifier. */
      if (S.net) S.net.send({ t: 'skin', skin: b.dataset.skin || null });
    };
  });

  body.querySelectorAll('[data-buy]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try {
        const out = await api('/api/purchase', 'POST', { identify: b.dataset.buy, quantity: 1 });
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

/* Un panneau qu'on ouvre et referme trois fois de suite ne doit pas frapper le
   reseau trois fois. Trente secondes suffisent a couvrir ce va-et-vient sans
   jamais montrer un classement perime. */
/**
 * Une parure se possede une fois, puis se PORTE — elle ne se consomme pas.
 *
 * ⚠️ LE MEME BOUTON NE PEUT PAS DIRE LES DEUX. « 600 pieces » pour un objet
 * deja acquis n'a aucun sens, et « porter » pour un objet qu'on n'a pas non plus.
 * Le bouton change donc de role selon ce que le joueur possede : acheter, porter,
 * ou retirer si c'est deja celle qu'il a aux mains.
 */
function estParure(p) {
  return p && p.category === 'Skin';
}

/** L'image d'un article : la face 5 de la parure, ou l'icone de l'effet. */
function vignette(p) {
  if (!estParure(p)) return bonusArt(p.identify);
  return ASSETS + 'img/skins/' + p.identify + '/die_5.png';
}

function bouton(p, have) {
  const possede = (have.get(p.identify) || 0) > 0;
  if (estParure(p) && possede) {
    const portee = S.me && S.me.skin === p.identify;
    return '<button class="dc-btn dc-btn-sm' + (portee ? ' dc-btn-ghost' : '') + '"'
      + ' data-skin="' + esc(portee ? '' : p.identify) + '">'
      + esc(t(portee ? 'skin.remove' : 'skin.wear')) + '</button>';
  }
  const trop = S.me && S.me.coins < p.basic_price;
  return '<button class="dc-btn dc-btn-sm" data-buy="' + esc(p.identify) + '"'
    + (trop ? ' disabled' : '') + '>' + p.basic_price
    + '<img class="dc-coin" src="' + ASSETS + 'img/icon_coin.png" alt=""></button>';
}

const LADDER_TTL = 30000;
let ladderCache = null;

export async function renderRanking(body) {
  body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3><div class="dc-loading">'
    + esc(t('ladder.reading')) + '</div>';
  try {
    if (!ladderCache || Date.now() - ladderCache.at > LADDER_TTL) {
      const recu = await api('/api/leaderboard?limit=10');
      /* ⚠️ ON NE MET PAS UN ECHEC EN CACHE. Ranger `null` ici, c'est promettre
         trente secondes de classement vide meme si le reseau revient dans la
         seconde — et c'est aussi ce qui faisait planter la ligne suivante. */
      if (!recu) {
        body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3><p class="dc-err">'
          + esc(t('connect.outOfReach')) + '</p>';
        return;
      }
      ladderCache = { at: Date.now(), data: recu };
    }
    const rows = (ladderCache.data && ladderCache.data.players) || [];
    const mine = ladderCache.data && ladderCache.data.me;
    const inTop = mine && rows.some((p) => p.pseudo === mine.pseudo);
    body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3>' + (rows.length
      ? `<table class="dc-ladder">
          <thead><tr><th>#</th><th>${esc(t('ladder.captain'))}</th><th>${esc(t('ladder.elo'))}</th>
          <th>${esc(t('ladder.w'))}</th><th>${esc(t('ladder.l'))}</th><th>${esc(t('ladder.d'))}</th></tr></thead>
          <tbody>${rows.map((p, i) => `
            <tr class="${S.me && p.pseudo === S.me.pseudo ? 'dc-ladder-me' : ''}">
              <td>${i + 1}</td><td>${esc(p.display_name || p.pseudo)}</td>
              <td><b>${p.rating}</b></td><td>${p.wins}</td><td>${p.losses}</td><td>${p.draws}</td>
            </tr>`).join('')}
          ${mine && !inTop ? `<tr class="dc-ladder-me dc-ladder-far">
              <td>${mine.rang}</td><td>${esc(mine.display_name || mine.pseudo)}</td>
              <td><b>${mine.rating}</b></td><td>${mine.wins}</td><td>${mine.losses}</td>
              <td>${mine.draws}</td></tr>` : ''}
          </tbody></table>`
      : '<p class="dc-dim">' + esc(t('ladder.empty')) + '</p>');
  } catch (e) {
    body.innerHTML = `<h3>${esc(t('ladder.title'))}</h3><p class="dc-err">${esc(e.message)}</p>`;
  }
}
