/* ============================================================================
   pages/dice_cale.js — LA CALE : ce que le telephone garde quand le reseau part.

   Deux choses y dorment, et deux seulement :

     LES JETONS   remis par le serveur pendant qu'on etait connecte. Chacun vaut
                  une partie hors ligne, et porte la graine dont sortiront tous
                  ses des. Sans jeton, pas de partie hors ligne — c'est ce qui
                  empeche d'en fabriquer mille.

     LES PARTIES  jouees et pas encore verifiees. Elles attendent le retour du
                  reseau, puis partent par petits paquets.

   ⚠️ LE STOCKAGE PEUT REFUSER, ET CE N'EST PAS UNE PANNE. Navigation privee,
   quota plein, reglages du telephone : `localStorage` jette. Le jeu doit alors
   continuer SANS mode hors ligne plutot que de s'arreter — on perd une
   commodite, pas la partie en cours.

   ⛔ ET ON NE GARDE PAS TOUT. Cent parties en attente, c'est cent verifications
   a faire d'un coup au retour : le bouchon qu'on veut eviter. Au-dela du
   plafond, les plus anciennes cedent la place — elles n'auraient de toute facon
   plus rien rapporte, le serveur ne creditant qu'un nombre limite de parties
   hors ligne par jour.
   ============================================================================ */

const CLE_JETONS = 'pd.jetons';
const CLE_PARTIES = 'pd.horsligne';
const MAX_EN_ATTENTE = 40;

function lire(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return defaut;
    const v = JSON.parse(brut);
    return Array.isArray(v) ? v : defaut;
  } catch (_) { return defaut; }
}

function ecrire(cle, valeur) {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); return true; }
  catch (_) { return false; }
}

/* ── les jetons ──────────────────────────────────────────────────────────── */

export function jetons() { return lire(CLE_JETONS, []); }

/** Ranger le lot recu du serveur. On remplace : le serveur fait autorite. */
export function rangerJetons(liste, regles) {
  const propres = (liste || [])
    .filter((j) => j && typeof j.id === 'string' && Number.isFinite(Number(j.graine)))
    .map((j) => ({ id: j.id, graine: Number(j.graine) }));
  ecrire(CLE_JETONS, propres);
  if (regles) { try { localStorage.setItem('pd.jetons.regles', JSON.stringify(regles)); } catch (_) { /* tant pis */ } }
  return propres.length;
}

export function reglesHorsLigne() {
  try { return JSON.parse(localStorage.getItem('pd.jetons.regles') || '{}') || {}; }
  catch (_) { return {}; }
}

/**
 * Prendre un jeton pour jouer.
 *
 * ⚠️ IL EST RETIRE AVANT LA PARTIE, PAS APRES. Un telephone qui s'eteint au
 * milieu ne doit pas rendre le meme jeton a la partie suivante : le serveur le
 * refuserait au retour, et le joueur perdrait DEUX parties au lieu d'une.
 */
export function prendreUnJeton() {
  const liste = jetons();
  const pris = liste.shift();
  if (!pris) return null;
  ecrire(CLE_JETONS, liste);
  return pris;
}

/* ── qui je suis, quand le serveur ne peut pas me le dire ────────────────── */

const CLE_MOI = 'pd.moi';

/**
 * ⚠️ SANS CE SOUVENIR, LE MODE HORS LIGNE JOUE POUR UN INCONNU. Le capitaine,
 * la parure et le nom viennent du message d'accueil : sans reseau, il n'arrive
 * jamais. Le joueur se retrouverait avec Mary Read et des des nus, alors qu'il a
 * peut-etre gagne Grace O'Malley et une gravure. On garde donc la derniere
 * fiche connue — elle ne decide de rien, elle habille.
 */
export function rangerMoi(me) {
  if (!me) return;
  try {
    localStorage.setItem(CLE_MOI, JSON.stringify({
      name: me.name, captain: me.captain, skin: me.skin, motif: me.motif,
      rating: me.rating, coins: me.coins, premium: me.premium, games: me.games,
      wins: me.wins, losses: me.losses, draws: me.draws,
    }));
  } catch (_) { /* stockage refuse : on jouera sans parure */ }
}

export function moi() {
  try { return JSON.parse(localStorage.getItem(CLE_MOI) || 'null'); }
  catch (_) { return null; }
}

/* ── les parties en attente ──────────────────────────────────────────────── */

export function enAttente() { return lire(CLE_PARTIES, []); }

export function garderPartie(jeton, journal) {
  const liste = enAttente();
  liste.push({ jeton, journal, a: Date.now() });
  /* Les plus anciennes cedent : elles ne rapporteraient plus rien. */
  while (liste.length > MAX_EN_ATTENTE) liste.shift();
  return ecrire(CLE_PARTIES, liste);
}

/** Retirer celles que le serveur a traitees, quel qu'ait ete son verdict. */
export function oublierParties(jetonsTraites) {
  const traites = new Set(jetonsTraites || []);
  const reste = enAttente().filter((p) => !traites.has(p.jeton));
  ecrire(CLE_PARTIES, reste);
  return reste.length;
}

/* ── la position au classement ───────────────────────────────────────────── */

/**
 * ⚠️ ELLE EST GARDEE PARCE QU'ELLE VIENT D'AILLEURS. Les pieces et les points
 * arrivent dans le message `me` de la socket ; la POSITION, elle, se calcule sur
 * toute la table des joueurs et ne voyage que par la route du classement. Sans
 * memoire, la plaque afficherait un tiret a chaque ouverture, le temps de la
 * requete — et pour toujours en mode hors ligne.
 */
const CLE_RANG = 'pd.rang';

export function rangerRang(r) {
  const v = Math.max(0, Math.round(Number(r) || 0));
  if (!v) return;
  try { localStorage.setItem(CLE_RANG, String(v)); } catch (_) { /* stockage refuse */ }
}

export function rangConnu() {
  try {
    const v = Number(localStorage.getItem(CLE_RANG));
    return v > 0 ? v : 0;
  } catch (_) { return 0; }
}
