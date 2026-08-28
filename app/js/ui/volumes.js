/* ============================================================================
   ui/volumes.js — LE NIVEAU DE CHAQUE CANAL, ET RIEN D'AUTRE.

   ⚠️ UN SEUL INTERRUPTEUR NE SUFFISAIT PLUS. Le jeu n'offrait que « son
   coupe / son actif » : le joueur qui trouvait la musique trop forte n'avait
   qu'un seul geste possible — tout eteindre, y compris le claquement du de qui
   lui dit que son coup est parti. C'est le reglage le plus demande de tous les
   jeux, et le plus simple a rendre.

   ⛔ CE FICHIER NE JOUE AUCUN SON ET NE CONNAIT NI `S`, NI `Sfx`, NI `Musique`.
   Il ne detient que deux nombres et sait les ecrire sur le telephone ; ceux qui
   produisent du son s'abonnent. Cette separation n'est pas de la coquetterie :
   c'est ce qui permet a la modale des reglages (`boot.js`, qui vit dans la
   coquille) de bouger un curseur sans importer une seule ligne du jeu.

   ⚠️ ET LES DEUX CANAUX N'ONT PAS LE MEME PLAFOND. Les effets sont deja regles
   a leur maximum utile dans le code (le de a 0,42, la piece a 0,35...) : monter
   au-dela ne les rendrait pas plus clairs, seulement satures. La musique, elle,
   est volontairement basse pour laisser passer les des — le joueur qui la veut
   en avant doit pouvoir la monter AU-DESSUS du melange par defaut. D'ou un
   plafond a 1 d'un cote et a 1,67 de l'autre, invisible pour qui lit « 60 % » :
   il voit deux curseurs identiques, et chacun fait ce qu'il faut.
   ============================================================================ */

const CLE = 'pd.volumes';

/* Ce que vaut 100 % sur chaque curseur, en facteur applique aux niveaux regles
   dans le code. Effets : 100 % = le melange d'origine, pas plus. Musique :
   60 % = le melange d'origine, donc de la marge pour monter. */
const PLAFOND = { effets: 1, musique: 1 / 0.6 };

/** Position de depart des curseurs, en pour-cent. */
export const DEFAUT = { effets: 100, musique: 60 };

const abonnes = new Set();
let niveaux = null;

function borne(v, defaut) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return defaut;
  return Math.min(100, Math.max(0, n));
}

function lire() {
  let brut = {};
  try { brut = JSON.parse(localStorage.getItem(CLE) || '{}') || {}; }
  catch (_) { brut = {}; /* stockage refuse ou contenu abime : on repart des defauts */ }
  return {
    effets: borne(brut.effets, DEFAUT.effets),
    musique: borne(brut.musique, DEFAUT.musique),
  };
}

/** Les deux positions de curseur, en pour-cent (0 a 100). */
export function volumes() {
  if (!niveaux) niveaux = lire();
  return { effets: niveaux.effets, musique: niveaux.musique };
}

/**
 * Le facteur a appliquer aux niveaux du code pour un canal.
 * 0 = silence, 1 = le melange regle a la main, au-dela = plus fort que lui.
 */
export function facteur(canal) {
  const v = volumes()[canal];
  return (v / 100) * (PLAFOND[canal] || 1);
}

/** Deplacer un curseur : on ecrit, puis on previent ceux qui jouent. */
export function reglerVolume(canal, pourCent) {
  const v = borne(pourCent, DEFAUT[canal] || 100);
  volumes();
  if (niveaux[canal] === v) return v;
  niveaux[canal] = v;
  try { localStorage.setItem(CLE, JSON.stringify(niveaux)); }
  catch (_) { /* mode prive : le reglage vaut pour cette session, c'est deja ca */ }
  for (const fn of abonnes) { try { fn(canal, v); } catch (_) { /* un abonne casse n'en punit pas un autre */ } }
  return v;
}

/**
 * S'abonner aux deplacements. Renvoie de quoi se desabonner — et appelle tout
 * de suite `fn(null, null)` pour que l'abonne se mette a niveau sans avoir a
 * dupliquer l'application initiale.
 */
export function surVolume(fn) {
  abonnes.add(fn);
  try { fn(null, null); } catch (_) { /* idem */ }
  return () => abonnes.delete(fn);
}
