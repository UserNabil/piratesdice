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
      <li>${t('rules.6', { ia: S.rules.aiReward, rang: S.rules.rankReward })}</li>
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

/* La partie est-elle en cours ? La boutique ferme alors ses caisses. */
function enPartie() {
  return !!(S.state && S.state.phase && S.state.phase !== 'over');
}

export async function renderShop(body) {
  /* ⛔ ON N'ACHETE PAS SA MISE EN COURS DE ROUTE. Vecu : 1000 pieces misees,
     presque 700 depensees en bonus PENDANT la partie, puis defaite — la mise
     n'engageait plus qu'une bourse deja videe, et les bonus achetes servaient a
     gagner la partie meme qu'ils desamorcaient. Le serveur refuse la depense ;
     l'ecran doit le DIRE, sinon le joueur ne comprend qu'un bouton mort. */
  if (enPartie()) {
    body.innerHTML = `<h3>${esc(t('shop.title'))}</h3>
      <div class="dc-shop-shut">
        <img src="${ASSETS}img/icon_coin.png" alt="">
        <p>${esc(t('shop.shutTitle'))}</p>
        <span>${esc(t('shop.shutHint'))}</span>
      </div>`;
    return;
  }
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

/* Les trois premieres places portent leur medaille. Au-dela, le rang chiffre :
   une quatrieme medaille ne voudrait plus rien dire. */
/* ⚠️ UNE IMAGE ET UN CHIFFRE NU NE S'ALIGNENT PAS. Les trois premieres lignes
   rendaient une `<img>`, les suivantes une chaine posee dans la cellule : deux
   boites de hauteurs et de largeurs differentes, donc trois medailles decalees
   au-dessus d'une colonne de chiffres — retour de l'admin. Les deux passent
   maintenant par la MEME boite (`.dc-rank-box`), centree et de taille fixe :
   c'est la boite qui tient la colonne, pas son contenu. */
export function medaille(rang) {
  const dedans = rang >= 1 && rang <= 3
    ? `<img class="dc-rank-medal" src="${ASSETS}img/rank_${rang}.png" alt="${rang}">`
    : `<span class="dc-rank-num">${rang}</span>`;
  return `<span class="dc-rank-box">${dedans}</span>`;
}

let ladderCache = null;

/** Le tableau lui-meme, une fois les lignes connues. */
function peindreClassement(body, data) {
  const rows = (data && data.players) || [];
  const mine = data && data.me;
  const inTop = mine && rows.some((p) => p.pseudo === mine.pseudo);
  body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3>' + (rows.length
    ? `<table class="dc-ladder">
        <thead><tr><th>#</th><th>${esc(t('ladder.captain'))}</th><th>${esc(t('ladder.elo'))}</th>
        <th>${esc(t('ladder.w'))}</th><th>${esc(t('ladder.l'))}</th><th>${esc(t('ladder.d'))}</th></tr></thead>
        <tbody>${rows.map((p, i) => `
          <tr class="${S.me && p.pseudo === S.me.pseudo ? 'dc-ladder-me' : ''}">
            <td>${medaille(i + 1)}</td><td>${esc(p.display_name || p.pseudo)}</td>
            <td><b>${p.rating}</b></td><td>${p.wins}</td><td>${p.losses}</td><td>${p.draws}</td>
          </tr>`).join('')}
        ${mine && !inTop ? `<tr class="dc-ladder-me dc-ladder-far">
            <td>${medaille(mine.rang)}</td><td>${esc(mine.display_name || mine.pseudo)}</td>
            <td><b>${mine.rating}</b></td><td>${mine.wins}</td><td>${mine.losses}</td>
            <td>${mine.draws}</td></tr>` : ''}
        </tbody></table>`
    : '<p class="dc-dim">' + esc(t('ladder.empty')) + '</p>');
}

/**
 * Le classement, RELU A CHAQUE OUVERTURE.
 *
 * ⛔ IL Y AVAIT UN CACHE DE TRENTE SECONDES, ET C'ETAIT LA MAUVAISE ECONOMIE.
 * On ouvre le classement juste apres une partie, precisement pour voir ce
 * qu'elle a change : une demi-minute d'avance suffit a montrer l'ancien
 * chiffre a celui qui vient de gagner, et il n'a aucun moyen de savoir que
 * l'ecran lui ment. Une requete de quelques centaines d'octets ne merite pas
 * qu'on prenne ce risque.
 *
 * Le cache reste, mais il ne decide plus rien : il sert a peindre TOUT DE
 * SUITE le dernier tableau connu, pour ne pas repartir d'un ecran vide, et la
 * reponse fraiche le remplace des qu'elle arrive.
 */
export async function renderRanking(body) {
  if (ladderCache) peindreClassement(body, ladderCache.data);
  else {
    body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3><div class="dc-loading">'
      + esc(t('ladder.reading')) + '</div>';
  }

  const recu = await api('/api/leaderboard?limit=10');
  /* Le panneau a pu etre referme pendant l'attente : on ne peint pas dans une
     boite qui n'est plus a l'ecran. */
  if (!body.isConnected) return;
  if (!recu) {
    /* ⚠️ ON NE MET PAS UN ECHEC EN CACHE, ET ON N'EFFACE PAS CE QU'ON MONTRAIT.
       Un reseau qui tousse ne doit pas valoir un classement vide. */
    if (!ladderCache) {
      body.innerHTML = '<h3>' + esc(t('ladder.title')) + '</h3><p class="dc-err">'
        + esc(t('connect.outOfReach')) + '</p>';
    }
    return;
  }
  ladderCache = { at: Date.now(), data: recu };
  peindreClassement(body, recu);
}
