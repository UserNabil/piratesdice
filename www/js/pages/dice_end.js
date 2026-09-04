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
import { ouvrirFicheSucces } from './dice_panels.js';

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
  /* ⛔ TROIS SUR QUATORZE, ET « et 11 de plus ». On venait d'en gagner quatorze
     d'un coup et on n'en voyait que trois : les onze autres etaient un CHIFFRE.
     C'est le moment de la partie ou l'on est le plus curieux de ce qu'on a
     accompli, et c'est celui ou on le montrait le moins. La liste les porte
     tous et defile ; chaque ligne s'ouvre sur sa fiche, comme dans la page. */
  return `<div class="dc-over-succes">
    <h4>${esc(t('over.succes'))}</h4>
    <div class="dc-over-suc-liste">${liste.map((s) => `<button class="dc-over-suc"
        data-fiche-fin="${esc(s.identify)}" title="${esc(t('suc.' + s.identify + '.name'))}">
      <img src="${ASSETS}img/succes/${esc(s.identify)}.png" alt="">
      <b>${esc(t('suc.' + s.identify + '.name'))}</b>
    </button>`).join('')}</div>
    <div class="dc-over-suc-gain">${m.maudits ? '+' + m.maudits + PIECE_MAUDITE : ''}${
      (m.objets && m.objets.length)
        ? ` <span class="dc-over-objet">${esc(t('over.objet', { n: m.objets.length }))}</span>` : ''}</div>
  </div>`;
}

/* ⛔ LES ETOILES SUR LA CARTE DE FIN. « Dans le resultat final on doit
   afficher les etoiles et la description des etoiles gagnees durant la partie. »
   Trois lignes : gagner, la contrainte de style, la contrainte d'excellence —
   chacune allumee si elle a ete DECROCHEE CETTE PARTIE (masquePartie), avec sa
   phrase. Une etoile toute neuve (jamais eue avant) brille en plus. */
function objectifTexte(code, seuil) {
  const cle = 'camp.obj.' + code;
  const dit = t(cle, { n: seuil });
  return dit && !dit.startsWith('camp.obj.') ? dit : code;
}
function etoilesCampagne(m) {
  const c = m.campagne;
  if (!c) return '';
  const lignes = [
    { bit: 1, txt: t('camp.obj1') },
    { bit: 2, txt: objectifTexte(c.contrainte2, c.seuil2) },
    { bit: 4, txt: objectifTexte(c.contrainte3, c.seuil3) },
  ];
  const gagnees = (c.masquePartie & 1 ? 1 : 0) + (c.masquePartie & 2 ? 1 : 0) + (c.masquePartie & 4 ? 1 : 0);
  return `<div class="dc-over-etoiles">
      <div class="dc-over-etoiles-tete">${esc(t('camp.etoilesGagnees', { n: gagnees }))}</div>
      <ul>${lignes.map((l) => {
        const pris = (c.masquePartie & l.bit) !== 0;
        const neuve = (c.neuves & l.bit) !== 0;
        return `<li class="${pris ? 'dc-obj-pris' : 'dc-obj-rate'}${neuve ? ' dc-obj-neuve' : ''}">${
          pris ? '\u2b50' : '\u2606'} ${esc(l.txt)}</li>`;
      }).join('')}</ul>
    </div>`;
}

export function onOver(m) {
  /* ⚠️ CELUI QUI PART A DEJA CHOISI. `requestClose` pose ce drapeau avant
     d'envoyer `leave` : l'annonce de fin qui suit lui est destinee autant qu'a
     l'autre, mais elle n'a plus rien a lui apprendre. On l'avale une fois — et
     une seule, pour que la partie suivante retrouve sa carte de fin. */
  /* ⚠️ LA PAGE DES SUCCES EST PERIMEE DES QU'UNE PARTIE SE TERMINE. Les
     compteurs viennent de bouger cote serveur ; garder la liste en cache
     montrerait « 47 / 50 » a quelqu'un qui vient de passer 50.
     ⛔ ET CELA VAUT AUSSI QUAND ON QUITTE. Le retour anticipe ci-dessous sautait
     ces trois lignes : le serveur avait pourtant compte la partie, bouge les
     compteurs et parfois ouvert un haut fait, mais les deux pages restaient
     figees sur leur ancien contenu pour TOUTE la session. On oublie d'abord, on
     avale ensuite. */
  S.succes = null;
  S.historique = null;
  /* ⚠️ ON OUBLIE, PUIS ON REDEMANDE TOUT DE SUITE. Depuis que les hauts faits se
     RECUPERENT, la liste ne sert plus seulement a peindre une page qu'on ouvrira
     peut-etre : elle nourrit la bulle de la barre du bas. L'oublier sans la
     redemander eteindrait la bulle au moment precis ou elle a quelque chose a
     dire — la fin d'une partie est l'instant ou les hauts faits tombent. */
  if (S.net) S.net.send({ t: 'succes' });
  if (S.me && typeof m.bourseMaudite === 'number') S.me.premium = m.bourseMaudite;
  if (S.quitting) { S.quitting = false; return; }
  const el = $('#dc-over');
  /* ⚠️ SANS CE GARDE, UNE CARTE DE FIN QUI NE S'AFFICHE PAS. Si le conteneur a
     disparu (navigation en cours), `el.innerHTML` plus bas jetait, le routeur
     avalait l'exception, et le joueur restait sur le plateau mort sans rien. */
  if (!el) { console.error('[fin] conteneur #dc-over introuvable'); return; }
  /* ⚠️ MEME PIEGE POUR LES SCORES. Le serveur les envoie toujours, mais un
     message de fin mutile ferait jeter `m.scores[0]` — exception avalee, carte
     jamais peinte. On retombe sur un score neutre plutot que sur un ecran fige. */
  const sc = Array.isArray(m.scores) ? m.scores : [0, 0];
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
      <div class="dc-over-score">${sc[0]} <span>—</span> ${sc[1]}</div>
      <div class="dc-over-line dc-over-foe">
        <img class="dc-over-cap" src="${captainArt(m.opponentCaptain)}" alt=""
             title="${esc(captainTrait(m.opponentCaptain))}">
        ${esc(t('over.against', { name: m.opponent }))}
      </div>
      ${etoilesCampagne(m)}
      ${rating}
      <!-- ⚠️ L'OR DES HAUTS FAITS S'AJOUTE A LA PRIME, ET IL DOIT SE VOIR. La
           ligne n'annoncait que la prime de match : le joueur lisait « +20 »
           pendant que sa bourse en recevait 520. On additionne, comme la bourse
           le fait. -->
      <div class="dc-over-line">${esc(t('over.coins', {
          delta: (m.coinDelta + (m.orSucces || 0) >= 0 ? '+' : '') + (m.coinDelta + (m.orSucces || 0)) }))}
        <img class="dc-coin" src="${ASSETS}img/icon_coin.png" alt=""></div>
      ${reason}
      <!-- ⛔ HORS LIGNE, RIEN N'EST ACQUIS TANT QUE LE SERVEUR N'A PAS VERIFIE.
           Annoncer des pieces ici serait une promesse qu'on ne tient pas : la
           partie peut encore etre refusee, ou tomber au-dela du plafond du
           jour. On dit ce qui est vrai — elle est jouee, elle attend. -->
      ${m.horsLigne ? `<div class="dc-over-line dc-dim">${esc(t(m.horsLigneLibre
        /* ⚠️ DEUX PHRASES, PARCE QUE CE NE SONT PAS DEUX FOIS LA MEME SITUATION.
           Avec un jeton, la partie ATTEND une verification et sera payee : c'est
           une promesse tenable. Sans jeton, elle ne sera jamais payee — le
           serveur n'a aucun moyen de la verifier. Dire « la recompense arrive »
           dans ce cas serait un mensonge qui se decouvrirait a la reconnexion. */
        ? 'over.horsLigneLibre' : 'over.horsLigne'))}</div>` : ''}
      ${hautsFaits(m)}
      <div class="dc-over-btns">
        <button class="dc-btn dc-again-btn" id="dc-again"><img class="dc-again-icone"
             src="${ASSETS}img/icon_replay.png" alt="">${esc(S.salon
          ? t('over.againFriend', { name: m.opponent || t('game.opponent') })
          /* ⛔ EN MODE PIRATERIE, ON AVANCE. Une victoire propose d'abord le
             NIVEAU SUIVANT ; une defaite propose de rejouer le niveau. Le
             second bouton ramene a la carte de l'aventure, pas au pont. */
          : (S.campagneEnCours && m.outcome === 'win'
              ? t('camp.suivant')
              : t('over.again')))}</button>
        <button class="dc-btn dc-btn-ghost" id="dc-back">${esc(
          S.campagneEnCours ? t('camp.retourAventure') : t('over.back'))}</button>
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
  /* Chaque haut fait du bandeau ouvre sa fiche. Le detail vient du message de
     fin : la liste de la page a ete effacee a l'instant et n'est pas revenue. */
  for (const b of el.querySelectorAll('[data-fiche-fin]')) {
    const brut = (Array.isArray(m.succes) ? m.succes : [])
      .find((x) => x.identify === b.dataset.ficheFin) || {};
    b.onclick = () => ouvrirFicheSucces(b.dataset.ficheFin, {
      identify: b.dataset.ficheFin,
      reward: brut.reward || 0,
      or: brut.reward_gold || 0,
      objet: brut.reward_item || null,
      cible: 0, valeur: 0, gagne: true,
    });
  }

  $('#dc-again').onclick = () => {
    leave();
    /* ⛔ « REJOUER » RENVOYAIT DANS LA FILE, MEME APRES UN DUEL ENTRE AMIS. Les
       deux se retrouvaient alors soumis a l'evitement de la file — donc a
       s'attendre pour rien — alors que leur salon est encore ouvert. On y
       retourne directement : c'est le sens du bouton quand il porte un nom. */
    if (S.salon) { S.net.send({ t: 'relancer' }); return; }
    /* ⛔ EN PIRATERIE, LE BOUTON PRINCIPAL AVANCE OU RETENTE. Victoire : le
       niveau suivant (C01N2 apres C01N1, C02N1 apres un boss) ; si le serveur
       le juge encore ferme, son refus traduit s'affiche et on n'a rien perdu.
       Defaite : on rejoue LE niveau — pas un solo anonyme qui ne compterait
       pour rien. */
    if (S.campagneEnCours && S.net && S.net.ready) {
      let cible = S.campagneEnCours;
      if (m.outcome === 'win') {
        /* ⚠️ ON DECOUPE LA CHAINE, ON NE LA REGEXE PAS. Un litteral d'expression
           reguliere avec groupes — `/^C(..)N(.)$/` — se lisait « appel a C() et
           N() » pour le controleur statique du build, qui refusait de compiler.
           L'identifiant « C01N3 » se lit aussi bien au caractere pres. */
        const code = String(S.campagneEnCours);
        if (code.length === 5 && code[0] === 'C' && code[3] === 'N') {
          const pal = parseInt(code.slice(1, 3), 10);
          const ord = parseInt(code.slice(4), 10);
          if (ord < 5) cible = 'C' + String(pal).padStart(2, '0') + 'N' + (ord + 1);
          else if (pal < 15) cible = 'C' + String(pal + 1).padStart(2, '0') + 'N1';
          /* Le tout dernier boss battu : il n'y a plus de suivant, on rejoue. */
        }
      }
      S.net.send({ t: 'campagne.jouer', identify: cible });
      return;
    }
    /* ⛔ ET HORS LIGNE, CE BOUTON NE FAISAIT RIEN. `S.net` est alors la vraie
       liaison — morte — et son `send()` rend `false` sans un mot : la carte se
       fermait, aucune partie ne demarrait, aucun message. C'est pourtant la, ou
       il n'y a rien d'autre a faire, qu'on enchaine les parties. Le pont a
       toujours eu ce repli (« Affronter l'IA » y bascule tout seul) ; la carte
       de fin, non. */
    if (!S.net || !S.net.ready) {
      if (UI.jouerHorsLigne) UI.jouerHorsLigne();
      return;
    }
    S.net.send({ t: 'play', mode });
  };
  $('#dc-back').onclick = () => {
    const versAventure = !!S.campagneEnCours;
    leave();
    /* Retour a la carte de la Piraterie : c'est d'elle qu'on etait parti. */
    if (versAventure && UI.openPage) UI.openPage('campagne');
  };
}
