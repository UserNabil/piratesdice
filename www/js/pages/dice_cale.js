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
