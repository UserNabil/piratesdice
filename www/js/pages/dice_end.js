/* ============================================================================
   pages/dice_end.js — la carte de fin de partie.

   Sortie de dice_match.js pour la meme raison que les panneaux : la traduction
   a fait deborder le fichier. L'ecran de fin est un morceau autonome — il ne
   dessine rien de la table, il rend le verdict.
   ============================================================================ */

import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { S, UI, ASSETS, PIECE_MAUDITE, fxUrl } from './dice_state.js';
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
/**
 * Les hauts faits debloques par CETTE partie, annonces ici et maintenant.
 *
 * ⛔ UN HAUT FAIT DECOUVERT TROIS ECRANS PLUS LOIN N'EST PAS UNE RECOMPENSE,
 * c'est une archive. Le joueur vient de faire quelque chose de remarquable : on
 * le lui dit sur la carte de fin, avec le dessin et ce que ca rapporte, pendant
 * qu'il s'en souvient encore.
 *
 * ⚠️ ET ON N'EN MONTRE QUE TROIS. Une partie peut en ouvrir huit d'un coup —
 * la premiere partie d'un compte en ouvre facilement quatre — et huit lignes
 * repousseraient les boutons hors de l'ecran. Au-dela, on compte : la page des
 * hauts faits porte le detail, c'est son role.
 */
function hautsFaits(m) {
  const liste = Array.isArray(m.succes) ? m.succes : [];
  if (!liste.length) return '';
  const montre = liste.slice(0, 3);
  const reste = liste.length - montre.length;
  return `<div class="dc-over-succes">
    <h4>${esc(t('over.succes'))}</h4>
    ${montre.map((s) => `<div class="dc-over-suc">
      <img src="${ASSETS}img/succes/${esc(s.identify)}.png" alt="">
      <b>${esc(t('suc.' + s.identify + '.name'))}</b>
    </div>`).join('')}
    ${reste > 0 ? `<div class="dc-over-suc-plus">${esc(t('over.succesPlus', { n: reste }))}</div>` : ''}
    <div class="dc-over-suc-gain">${m.maudits ? '+' + m.maudits + PIECE_MAUDITE : ''}</div>
  </div>`;
}

export function onOver(m) {
  /* ⚠️ CELUI QUI PART A DEJA CHOISI. `requestClose` pose ce drapeau avant
     d'envoyer `leave` : l'annonce de fin qui suit lui est destinee autant qu'a
     l'autre, mais elle n'a plus rien a lui apprendre. On l'avale une fois — et
     une seule, pour que la partie suivante retrouve sa carte de fin. */
  if (S.quitting) { S.quitting = false; return; }
  /* ⚠️ LA PAGE DES SUCCES EST PERIMEE DES QU'UNE PARTIE SE TERMINE. Les
     compteurs viennent de bouger cote serveur ; garder la liste en cache
     montrerait « 47 / 50 » a quelqu'un qui vient de passer 50. On l'oublie, la
     page la redemandera a la prochaine ouverture. */
  S.succes = null;
  S.historique = null;
  if (S.me && typeof m.bourseMaudite === 'number') S.me.premium = m.bourseMaudite;
  const el = $('#dc-over');
  const verdict = t(m.outcome === 'win' ? 'over.victory' : (m.outcome === 'loss' ? 'over.defeat' : 'over.draw'));
  const seal = m.outcome === 'win' ? 'seal_victory' : (m.outcome === 'loss' ? 'seal_defeat' : 'seal_draw');
  const delta = m.ratingAfter - m.ratingBefore;
  /* ⚠️ « NON CLASSEE » NE SUFFIT PAS, IL FAUT DIRE POURQUOI. Un joueur qui
     gagne et ne monte pas croit a une panne. Le serveur envoie la raison — le
     compte d'en face est trop neuf, l'ecart de niveau est trop grand, on a
     deja joue trois fois ensemble aujourd'hui, la table a ete quittee avant
     d'avoir joue — et l'ecran la lit telle quelle. */
  const POURQUOI = {
    new: 'over.notRatedNew', gap: 'over.notRatedGap',
    pair: 'over.notRatedPair', short: 'over.notRatedShort',
  };
  const rating = m.rated
    ? `<div class="dc-over-line"><img class="dc-insigne" src="${ASSETS}img/icon_elo.png"
         alt="" aria-hidden="true"> ${t('over.rang', {
        before: m.ratingBefore, after: '<b>' + m.ratingAfter + '</b>',
        delta: (delta >= 0 ? '+' : '') + delta })}</div>`
    : `<div class="dc-over-line dc-dim">${esc(t(POURQUOI[m.ratedWhy] || 'over.notRated'))}</div>`;
  const reason = m.reason === 'disconnect'
    ? `<div class="dc-over-line dc-dim">${esc(t('over.oppDropped'))}</div>`
    : (m.reason === 'quit' ? `<div class="dc-over-line dc-dim">${esc(t('over.someoneLeft'))}</div>` : '');

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
      ${hautsFaits(m)}
      <div class="dc-over-btns">
        <button class="dc-btn" id="dc-again">${esc(t('over.again'))}</button>
        <button class="dc-btn dc-btn-ghost" id="dc-back">${esc(t('over.back'))}</button>
      </div>
    </div>`;
  /* ⛔ LA PLUIE DE DOUBLONS EST PARTIE, ET LE SCEAU AVEC. Personne ne les avait
     jamais vus : `rain()` n'etait pas importee ici et levait une exception a
     chaque VICTOIRE, avalee par le routeur de messages — la carte etait
     construite, complete, et jamais allumee. La corriger a fait apparaitre une
     animation de dix megaoctets que personne n'avait demandee, par-dessus le
     verdict qu'elle etait censee feter. Le sceau, lui, restait de la premiere
     version : brun et bleu sur une carte violette.
     La PLUIE est partie pour de bon : dix megaoctets pour cacher le verdict
     qu'elle fetait. Le SCEAU, lui, revient — c'est le blason de la partie, il
     manquait a la carte. Il reste celui d'avant la refonte, et il le restera
     jusqu'a ce qu'un nouveau dessin arrive : le retirer n'etait pas la reponse.
     Et rien ne passe plus AVANT la ligne qui affiche le verdict. */
  el.classList.add('on');
  /* ⚠️ LA FANFARE PASSE DEVANT LA BOUCLE, ELLE NE S'Y AJOUTE PAS. Deux musiques
     en meme temps, meme d'accord entre elles, font une bouillie : la boucle de
     partie s'arrete, le verdict sonne, et le pont reprend la sienne quand le
     joueur y revient. */
  if (S.musique) S.musique.arreter();
  S.sfx.play(m.outcome === 'win' ? 'gagne' : (m.outcome === 'loss' ? 'perdu' : 'nul'), 0.4);

  const leave = () => { el.classList.remove('on'); S.state = null; S.seat = -1; UI.showMenu(); };
  UI.leaveMatch = leave;                     // la barre laterale s'en sert aussi
  /* ⚠️ LE MODE VIENT DU SERVEUR, PAS DE `rated`. Une partie multi peut
     desormais ne pas compter au classement : lue sur `rated`, « rejouer »
     aurait renvoye au solo quelqu'un qui cherchait un adversaire. */
  const mode = m.mode === 'multi' ? 'multi' : (m.rated ? 'multi' : 'solo');
  $('#dc-again').onclick = () => { leave(); S.net.send({ t: 'play', mode }); };
  $('#dc-back').onclick = leave;
}
