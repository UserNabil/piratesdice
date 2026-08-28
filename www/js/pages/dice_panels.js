/* ============================================================================
   pages/dice_panels.js — les trois panneaux du rail : regles, boutique, classement.

   Sortis de dice.js quand la traduction l'a fait passer au-dessus de la limite
   de 400 lignes. Le decoupage suit ce que les morceaux SONT : la coque d'un
   cote, les trois feuilles de l'autre.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toast } from '../ui/toast.js';
import { S, UI, ASSETS, PIECE_MAUDITE, bonusArt } from './dice_state.js';
import { renderBonusRack } from './dice_match.js';
import { messageServeur } from './dice_refus.js';

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
    /* Le serveur refuse en anglais ; le joueur lit sa langue. La table des
       refus vit dans dice.js et sert aussi la socket : un seul endroit ou
       traduire ce que dit le serveur. */
    toast(messageServeur((e && e.message) || '') || t('connect.outOfReach'), 'warn');
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

/* Les rayons de la boutique, dans l'ordre ou l'on s'habille. */
const RAYONS = [
  { cle: 'des', titre: 'shop.rayon.des', tient: estParure },
  { cle: 'motifs', titre: 'shop.rayon.motifs', tient: estMotif },
  { cle: 'bonus', titre: 'shop.rayon.bonus', tient: (p) => !porte(p) },
];

/* ⚠️ LE RAYON OUVERT SURVIT AU RE-RENDU. La boutique se redessine apres chaque
   achat : sans cette memoire, on achetait une gravure et on se retrouvait
   devant les jeux de des, a chercher ou l'on etait. */
let rayonOuvert = 'des';

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

  /* ⛔ TOUT ETAIT DANS UNE SEULE LISTE, ET ON NE TROUVAIT PLUS RIEN. Des jeux
     de des, des gravures et des jetons a usage unique se suivaient dans le
     meme rouleau, avec trois boutons qui ne veulent pas dire la meme chose —
     acheter, porter, retirer. On range donc par RAYON, dans l'ordre ou l'on
     s'habille : les des, ce qu'on grave dessus, puis ce qu'on emporte. */
  const article = (p) => `
      <div class="dc-shop-item">
        <img src="${vignette(p)}" alt="">
        <div class="dc-shop-txt">
          <b>${esc(shopText(p.identify, 'name', p.name))}</b>
          <span>${esc(shopText(p.identify, 'desc', p.description))}</span>
          <em>${esc(porte(p)
            ? (have.get(p.identify) ? t('skin.owned') : t('skin.appearance'))
            : t('shop.owned', { n: have.get(p.identify) || 0 }))}</em>
        </div>
        ${bouton(p, have)}
      </div>`;

  /* ⛔ LES TROIS RAYONS SE SUIVAIENT, ET LA BOUTIQUE FAISAIT TROIS ECRANS DE
     HAUT. Des titres dans un long rouleau donnent l'ordre des choses, pas
     l'acces : pour voir une gravure il fallait passer devant tous les jeux de
     des. En onglets, chaque rayon est a un doigt du precedent et la liste
     tient dans un ecran. */
  const pleins = RAYONS.map((r) => ({ r, lot: products.filter((p) => r.tient(p)) }))
    .filter((x) => x.lot.length);
  if (!pleins.some((x) => x.r.cle === rayonOuvert)) {
    rayonOuvert = pleins.length ? pleins[0].r.cle : 'des';
  }
  const ouvert = pleins.find((x) => x.r.cle === rayonOuvert);

  body.innerHTML = `<h3>${esc(t('shop.title'))}</h3>
    <div class="dc-shop-onglets" role="tablist">${pleins.map((x) => `
      <button class="dc-shop-onglet${x.r.cle === rayonOuvert ? ' on' : ''}"
              role="tab" aria-selected="${x.r.cle === rayonOuvert}"
              data-rayon="${esc(x.r.cle)}">${esc(t(x.r.titre))}</button>`).join('')}</div>
    <div class="dc-shop">${(ouvert ? ouvert.lot : []).map(article).join('')}</div>`;

  body.querySelectorAll('[data-rayon]').forEach((b) => {
    b.onclick = () => { rayonOuvert = b.dataset.rayon; renderShop(body); };
  });

  body.querySelectorAll('[data-skin]').forEach((b) => {
    b.onclick = () => {
      /* Une chaine vide veut dire « retirer » : le serveur remet les des
         d'origine, et n'a donc rien a verifier. */
      if (S.net) S.net.send({ t: 'skin', skin: b.dataset.skin || null });
    };
  });

  body.querySelectorAll('[data-motif]').forEach((b) => {
    b.onclick = () => {
      if (S.net) S.net.send({ t: 'motif', motif: b.dataset.motif || null });
    };
  });

  body.querySelectorAll('[data-buy]').forEach((b) => {
    b.onclick = async () => {
      b.disabled = true;
      try {
        const out = await api('/api/purchase', 'POST',
          { identify: b.dataset.buy, quantity: 1, devise: b.dataset.devise || 'basic' });
        /* ⛔ `api()` NE JETTE PAS, ELLE REND `null` — ET ELLE A DEJA PARLE. Sans
           cette ligne, le refus du serveur produisait un second message, en
           anglais et incomprehensible : « cannot read properties of null ». Le
           joueur voyait deux alertes pour un seul refus, dont une qui parlait de
           JavaScript. */
        if (!out) { b.disabled = false; return; }
        S.inventory = out.inventory || S.inventory;
        if (S.me) {
          if (typeof out.coins === 'number') S.me.coins = out.coins;
          if (typeof out.premium === 'number') S.me.premium = out.premium;
        }
        /* ⛔ PLUS D'ALERTE A CHAQUE ACHAT. Elle ne disait rien que l'ecran ne
           montre deja : la piece qui tinte, la bourse qui baisse, et le « en
           cale : n » qui monte sous l'objet meme. Cinq achats de suite
           empilaient cinq bandeaux identiques par-dessus la boutique — on ne
           voyait plus ce qu'on achetait. Le son et le compteur suffisent. */
        S.sfx.play('coin', 0.35);
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

/* Une GRAVURE se pose SUR la parure qu'on porte deja — elle ne la remplace
   pas. C'est toute la difference entre les deux rayons, et c'est pour cela
   qu'ils ne partagent ni le meme champ en base ni le meme bouton. */
function estMotif(p) {
  return p && p.category === 'Motif';
}

function porte(p) {
  return estParure(p) || estMotif(p);
}

/**
 * L'image d'un article : la face 5 de la parure, ou l'icone de l'effet.
 *
 * ⚠️ UNE GRAVURE N'A PAS DE DOSSIER A ELLE. Elle n'existe qu'en combinaison :
 * on montre donc la gravure sur les des d'origine, qui appartiennent a tout le
 * monde — l'acheteur voit le dessin, pas une parure qu'il n'a peut-etre pas.
 */
function vignette(p) {
  if (estMotif(p)) return ASSETS + 'img/skins/D000_' + p.identify + '/die_5.png';
  if (!estParure(p)) return bonusArt(p.identify);
  return ASSETS + 'img/skins/' + p.identify + '/die_5.png';
}

/**
 * Avec quelle monnaie cet article se paie-t-il, et combien.
 *
 * ⛔ `basic_price` PEUT ETRE NUL, ET C'ETAIT UN PIEGE MORTEL. Le bouton
 * affichait litteralement « null », et surtout : `S.me.coins < null` vaut
 * FALSE — donc le bouton restait actif, le joueur cliquait, et le serveur
 * repondait 400. Un prix absent ne veut pas dire gratuit ; il veut dire « pas
 * dans cette monnaie ». On choisit donc la devise AVANT de comparer quoi que ce
 * soit, et un article sans aucun prix n'est pas vendable du tout.
 */
function tarif(p) {
  const or = p.basic_price;
  const maudit = p.premium_price;
  if (or === null || or === undefined) {
    return (maudit === null || maudit === undefined)
      ? null : { devise: 'premium', prix: maudit };
  }
  return { devise: 'basic', prix: or };
}

function bouton(p, have) {
  const possede = (have.get(p.identify) || 0) > 0;
  if (porte(p) && possede) {
    const quoi = estMotif(p) ? 'motif' : 'skin';
    const actif = S.me && S.me[quoi] === p.identify;
    return '<button class="dc-btn dc-btn-sm' + (actif ? ' dc-btn-ghost' : '') + '"'
      + ' data-' + quoi + '="' + esc(actif ? '' : p.identify) + '">'
      + esc(t(actif ? 'skin.remove' : 'skin.wear')) + '</button>';
  }
  const tar = tarif(p);
  /* ⛔ UN ARTICLE SANS PRIX N'EST PAS UNE ERREUR D'AFFICHAGE, C'EST UNE
     RECOMPENSE. Les quatre ornements ne s'achetent avec aucune bourse : ils se
     gagnent aux hauts faits legendaires. Rendre une chaine vide laissait une
     carte muette, dont personne ne pouvait deviner ni le prix ni le moyen de
     l'obtenir — le joueur en aurait conclu a un bogue. La mention dit ce qu'il
     en est, et elle donne un but. */
  if (!tar) {
    return '<span class="dc-legendaire" title="' + esc(t('shop.legendaireAide')) + '">'
      + '<img src="' + ASSETS + 'img/icon_trophy.png" alt="">' + esc(t('shop.legendaire')) + '</span>';
  }
  const bourse = S.me ? (tar.devise === 'premium' ? (S.me.premium || 0) : (S.me.coins || 0)) : 0;
  const trop = S.me && bourse < tar.prix;
  const piece = tar.devise === 'premium'
    ? PIECE_MAUDITE
    : '<img class="dc-coin" src="' + ASSETS + 'img/icon_coin.png" alt="">';
  return '<button class="dc-btn dc-btn-sm' + (tar.devise === 'premium' ? ' dc-btn-maudit' : '') + '"'
    + ' data-buy="' + esc(p.identify) + '" data-devise="' + tar.devise + '"'
    + (trop ? ' disabled' : '') + '>' + tar.prix + piece + '</button>';
}

/* ══════════════════════════════════════════════════════════════════ succes ══
   LA PAGE DES SUCCES.

   ⚠️ ELLE MONTRE CE QU'ON N'A PAS, ET C'EST TOUT SON INTERET. Une page qui
   n'afficherait que les succes gagnes serait une vitrine a trophees : on la
   consulte une fois, apres coup. Celle-ci doit donner envie, donc elle montre la
   route — le compteur en cours contre la cible, et ce que la porte rapporte.

   ⚠️ ET ELLE NE COMPTE RIEN. Tout vient du serveur, y compris le progres : le
   client qui calculerait lui-meme « 47 des detruits » afficherait un chiffre que
   personne ne peut verifier, et qui serait faux des la premiere partie jouee sur
   un autre telephone.

   ⛔ L'ICONE N'EST PAS UNE `<img>`, ET C'EST DELIBERE. Les cent dessins n'existent
   pas encore ; une balise image sur un fichier absent affiche l'icone cassee du
   navigateur — cent fois. En fond CSS, une image manquante ne laisse voir que le
   medaillon dessine dessous, qui est deja presentable. Le jour ou les dessins
   arrivent, ils se posent dedans sans une ligne de code.
   ═════════════════════════════════════════════════════════════════════════ */

const FAMILLES = ['metier', 'plateau', 'guerre', 'effets', 'quarts', 'curiosites'];

function barre(valeur, cible) {
  const part = cible > 0 ? Math.max(0, Math.min(1, valeur / cible)) : 0;
  return '<span class="dc-suc-jauge"><i style="width:' + Math.round(part * 100) + '%"></i></span>';
}

/**
 * Ce qu'un haut fait rapporte, en trois monnaies possibles.
 *
 * ⚠️ L'OBJET PASSE EN PREMIER QUAND IL Y EN A UN. C'est la seule des trois
 * recompenses qu'on VOIT sur la table — un jeu de des, un effet — et c'est donc
 * elle qui donne envie. Les deux bourses viennent apres, dans l'ordre ou on les
 * depense : l'or tout de suite, le maudit plus tard.
 */
function recompense(s) {
  const bouts = [];
  if (s.objet) {
    bouts.push('<img class="dc-suc-objet" src="' + vignetteDe(s.objet)
      /* ⚠️ PASSER PAR LE REPLI, COMME TOUT LE RESTE DE LA BOUTIQUE. `t()` rend
         la CLE quand elle manque : l'infobulle affichait « shop.M005.name » —
         les quatre ornements n'ont de nom dans aucun des quatre catalogues,
         puisque c'est le serveur qui le porte. */
      + '" alt="" title="' + esc(nomObjet(s.objet)) + '">');
  }
  if (s.or) bouts.push(s.or + '<img class="dc-coin" src="' + ASSETS + 'img/icon_coin.png" alt="">');
  if (s.reward) bouts.push(s.reward + PIECE_MAUDITE);
  return bouts.join(' ');
}

/* Le nom d'un objet offert : celui du catalogue si le client l'a traduit, sinon
   celui que le serveur envoie avec le produit. */
function nomObjet(identify) {
  const cle = 'shop.' + identify + '.name';
  const traduit = t(cle);
  if (traduit !== cle) return traduit;
  const p = (S.shop || []).find((x) => x.identify === identify);
  return (p && p.name) || identify;
}

/* La vignette d'un objet offert : une parure se montre par sa face de cinq, un
   effet par son jeton. */
function vignetteDe(identify) {
  if (/^S\d/.test(identify)) return ASSETS + 'img/skins/' + identify + '/die_5.png';
  if (/^M\d/.test(identify)) return ASSETS + 'img/skins/D000_' + identify + '/die_5.png';
  return bonusArt(identify);
}

function ligneSucces(s) {
  const nom = t('suc.' + s.identify + '.name');
  const txt = t('suc.' + s.identify + '.txt');
  const fait = s.gagne;
  /* ⚠️ TROIS ETATS, PAS DEUX. Un haut fait est a faire, ou fait et non recupere,
     ou fait et encaisse. Le deuxieme est le seul qui demande quelque chose au
     joueur : c'est le seul qui porte un bouton. */
  /* ⛔ `!s.reclame` ETAIT FAUX CONTRE UN SERVEUR QUI N'EN PARLE PAS. Un serveur
     d'avant la recolte n'envoie pas ce champ : `undefined` rendait `!s.reclame`
     vrai, donc TOUT paraissait a recuperer — bouton sur chaque ligne gagnee et
     pastille a 45 sur la barre — alors que rien ne l'etait, et que le serveur
     aurait refuse la demande. On exige donc un `false` explicite : « pas encore
     recupere » et « le serveur ne sait pas ce que c'est » sont deux choses
     differentes, et une seule appelle un bouton. */
  const aPrendre = fait && s.reclame === false;
  return '<li class="dc-suc' + (fait ? ' dc-suc-on' : '')
      + (aPrendre ? ' dc-suc-du' : '') + '">'
    + '<span class="dc-suc-art" style="background-image:url(' + ASSETS + 'img/succes/'
      + esc(s.identify) + '.png)"></span>'
    + '<span class="dc-suc-txt"><b>' + esc(nom) + '</b><span>' + esc(txt) + '</span>'
    + (fait ? '' : barre(s.valeur, s.cible) + '<em>' + s.valeur + ' / ' + s.cible + '</em>')
    + '</span>'
    + (aPrendre
        ? '<button class="dc-suc-prendre" data-prendre="' + esc(s.identify) + '">'
            + esc(t('suc.prendre')) + '</button>'
        : '<span class="dc-suc-prix">' + recompense(s) + '</span>')
    + '</li>';
}

export function renderSucces(body) {
  /* ⚠️ ON DEMANDE UNE FOIS, PUIS ON REPEINT. Redemander a chaque ouverture
     ferait clignoter la page pour rien : les compteurs ne bougent qu'en fin de
     partie, et `over` invalide deja la liste. */
  if (!S.succes) {
    body.innerHTML = '<h3>' + esc(t('tab.succes')) + '</h3>'
      + '<p class="dc-empty">' + esc(t('ladder.reading')) + '</p>';
    /* ⛔ UNE DEMANDE AVALEE LAISSE LA PAGE EN ATTENTE POUR TOUJOURS. Quand la
       socket est tombee, `S.net` est nul : on peignait « Lecture du registre… »
       et on ne demandait rien — aucune erreur, aucune reprise, et le joueur
       restait devant une ligne qui ne bougerait plus jamais. On le dit. */
    if (S.net) S.net.send({ t: 'succes' });
    else body.innerHTML = body.innerHTML.replace(/<p class="dc-empty">[^<]*<\/p>/,
      '<p class="dc-empty">' + esc(t('connect.outOfReach')) + '</p>');
    return;
  }
  const liste = S.succes;
  const gagnes = liste.filter((s) => s.gagne).length;
  const total = liste.reduce((n, s) => n + (s.gagne ? 0 : s.reward), 0);
  const parFamille = new Map();
  for (const s of liste) {
    if (!parFamille.has(s.famille)) parFamille.set(s.famille, []);
    parFamille.get(s.famille).push(s);
  }
  const ordre = FAMILLES.filter((f) => parFamille.has(f))
    .concat([...parFamille.keys()].filter((f) => !FAMILLES.includes(f)));

  const aPrendre = liste.filter((s) => s.gagne && s.reclame === false);

  body.innerHTML = '<h3>' + esc(t('tab.succes')) + '</h3>'
    /* ⚠️ « 1 HAUTS FAITS SUR 9 » SE LIT COMME UNE FAUTE, PARCE QUE C'EN EST UNE.
       Une phrase qui compte doit accorder : deux cles plutot qu'un pluriel
       force, et le francais comme l'anglais y gagnent. */
    + '<p class="dc-suc-tete">' + esc(t(gagnes === 1 ? 'suc.done1' : 'suc.done',
        { n: gagnes, total: liste.length }))
    + (total ? ' · ' + esc(t('suc.reste', { n: total })) : '') + '</p>'
    /* Le bouton n'existe que s'il y a quelque chose a prendre : un « tout
       recuperer » toujours affiche, et gris neuf fois sur dix, apprend surtout
       a ne plus le regarder. */
    + (aPrendre.length
        ? '<button class="dc-suc-tout" data-prendre-tout>'
            + esc(t('suc.prendreTout', { n: aPrendre.length })) + '</button>'
        : '')
    + ordre.map((f) => '<h4 class="dc-suc-fam">' + esc(t('suc.fam.' + f)) + '</h4>'
        + '<ul class="dc-suc-liste">' + parFamille.get(f).map(ligneSucces).join('') + '</ul>').join('');

  brancherRecolte(body);
}

/**
 * Brancher les boutons de recolte.
 *
 * ⚠️ LE BOUTON SE DESARME LUI-MEME AU PREMIER APPUI. La reponse du serveur met
 * un aller-retour a revenir ; sans cela, trois appuis impatients enverraient
 * trois demandes pour la meme recompense. La seconde et la troisieme ne
 * paieraient rien — l'`UPDATE ... WHERE claimed_at IS NULL` s'en charge — mais
 * elles feraient clignoter la page et afficheraient « rien a recuperer » juste
 * apres une recolte reussie.
 */
function brancherRecolte(body) {
  const envoyer = (bouton, quoi) => {
    if (!S.net) { toast(t('connect.outOfReach'), 'warn'); return; }
    bouton.disabled = true;
    S.net.send({ t: 'reclamer', succes: quoi });
  };
  const tout = body.querySelector('[data-prendre-tout]');
  if (tout) tout.onclick = () => envoyer(tout, null);
  for (const b of body.querySelectorAll('[data-prendre]')) {
    b.onclick = () => envoyer(b, [b.dataset.prendre]);
  }
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
        <thead><tr><th>#</th><th>${esc(t('ladder.captain'))}</th><th><img class="dc-insigne" src="${ASSETS}img/icon_elo.png"
              alt="${esc(t('menu.rang'))}" title="${esc(t('menu.rang'))}"></th>
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
