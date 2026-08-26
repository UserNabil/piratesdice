/* ============================================================================
   ui/studio.js — L'APERCU. L'ATELIER, LUI, EST SUR LE MAC.

   ⛔ LA PREMIERE VERSION OUVRAIT LE PANNEAU SUR LE TELEPHONE, ET C'ETAIT
   ABSURDE : il couvrait les deux tiers de l'ecran, c'est-a-dire exactement ce
   qu'on cherchait a regler. On bougeait un curseur pour voir le plateau… sous le
   curseur. L'atelier appartient a la machine ou l'on travaille, l'apercu a
   l'appareil ou l'on regarde.

   Il ne reste donc ici que l'oreille : elle demande au Mac « quoi de neuf ? »
   cinq fois par seconde et pose ce qui a change sur `#dicewrap`. Le panneau,
   les curseurs et le bouton d'enregistrement sont dans `outils/studio.py`.

   ⚠️ ET IL NE COUTE RIEN QUAND L'ATELIER N'EST PAS LA. Sur un vrai telephone,
   dans le monde, personne ne repond a `localhost` : au troisieme echec on
   s'arrete pour de bon. Pas de minuterie qui tourne, pas de requete qui
   repart — un outil de developpement ne doit pas peser sur ceux qui jouent.

   OU IL CHERCHE L'ATELIER :
     localhost   le simulateur iOS partage la pile reseau du Mac
     10.0.2.2    c'est ainsi que l'emulateur Android nomme son hote
   Un vrai appareil sur le meme reseau demanderait l'adresse du Mac ; on la
   posera le jour ou l'on en aura besoin, pas avant.
   ============================================================================ */

const PORT = 8123;
const HOTES = ['localhost', '10.0.2.2'];
const PERIODE = 200;
const ECHECS_MAX = 3;

let base = null;
let version = -1;
let echecs = 0;
let minuterie = 0;
let posees = [];

/** Poser les valeurs recues, et retirer celles qui ont disparu. */
function appliquer(vars) {
  const wrap = document.getElementById('dicewrap');
  if (!wrap) return;
  /* ⚠️ ON RETIRE CE QUI N'EST PLUS LA. Sans ce nettoyage, un reglage remis a
     zero dans l'atelier resterait colle en style en ligne sur l'appareil : le
     bouton « tout remettre » n'aurait aucun effet visible, ce qui est pire que
     de ne pas l'avoir. */
  const nouvelles = Object.keys(vars);
  for (const nom of posees) {
    if (nouvelles.indexOf(nom) < 0) wrap.style.removeProperty(nom);
  }
  for (const nom of nouvelles) wrap.style.setProperty(nom, vars[nom]);
  posees = nouvelles;
}

async function demander() {
  try {
    const r = await fetch(base + '/etat', { cache: 'no-store' });
    if (!r.ok) throw new Error('refus');
    const d = await r.json();
    echecs = 0;
    if (d.v !== version) { version = d.v; appliquer(d.vars || {}); }
  } catch (e) {
    echecs += 1;
    if (echecs >= ECHECS_MAX) {
      clearInterval(minuterie);
      minuterie = 0;
    }
  }
}

/** Trouver l'atelier, s'il tourne. Une seule tentative par hote, et on oublie. */
async function chercherAtelier() {
  for (const hote of HOTES) {
    const url = 'http://' + hote + ':' + PORT;
    try {
      const r = await fetch(url + '/etat', { cache: 'no-store' });
      if (r.ok) return url;
    } catch (e) { /* personne a cette adresse */ }
  }
  return null;
}

/**
 * Brancher l'apercu. Rend `true` si un atelier repond.
 *
 * ⚠️ APPELE APRES LE PREMIER RENDU, JAMAIS AVANT. Deux requetes reseau au
 * demarrage retarderaient l'ouverture du jeu pour une fonction que personne
 * n'utilise en jouant.
 */
export async function brancherStudio() {
  base = await chercherAtelier();
  if (!base) return false;
  await demander();
  minuterie = setInterval(demander, PERIODE);
  return true;
}

/* ⛔ `reposerReglages` ET `ouvrirStudio` ONT DISPARU AVEC LE PANNEAU EMBARQUE.
   Le premier relisait le stockage local au demarrage : les reglages vivent
   desormais dans l'atelier, sur le Mac, et se rechargent en le rouvrant. Le
   second ouvrait le panneau qui cachait le jeu. Les garder « au cas ou » aurait
   laisse deux chemins pour une seule fonction, dont un mauvais. */
