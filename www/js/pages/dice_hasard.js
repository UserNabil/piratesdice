/* ============================================================================
   pages/dice_hasard.js — LE MEME HASARD QUE LE SERVEUR, AU BIT PRES.

   ⛔ COPIE DE `dice-server/src/game/tirage.js`. Les deux doivent donner la MEME
   suite pour une meme graine : c'est sur cette egalite que repose toute la
   verification des parties jouees hors ligne. Si l'un des deux change, les
   parties honnetes se font rejeter — et personne ne comprend pourquoi.
   ============================================================================ */
/* ============================================================================
   tirage.js — LE MEME HASARD DES DEUX COTES.

   ⛔ HORS LIGNE, C'EST LE TELEPHONE QUI LANCE LES DES — et c'est exactement la
   ou un client modifie se servirait. Sans garde-fou, il suffirait d'annoncer six
   six a chaque tour, de rentrer chez soi et d'encaisser cent hauts faits.

   LA PARADE N'EST PAS DE FAIRE CONFIANCE, C'EST DE NE PAS AVOIR A LE FAIRE. Le
   serveur remet, pendant qu'on est connecte, des JETONS DE PARTIE : chacun porte
   une graine. Hors ligne, tous les des d'une partie sont tires de cette graine,
   dans l'ordre. Au retour, le serveur REFAIT le meme tirage a partir de la meme
   graine et compare : un seul de qui ne correspond pas, et la partie entiere est
   rejetee. Le joueur choisit ses coups — c'est le jeu — mais plus ses des.

   ⚠️ LE GENERATEUR DOIT DONNER LA MEME SUITE DANS NODE ET DANS UNE WEBVIEW, au
   bit pres. `Math.random()` ne le peut pas : il n'est pas reproductible, meme
   avec une graine. Mulberry32 tient en six lignes, ne depend que des entiers 32
   bits de JavaScript, et se copie a l'identique cote client (c'est ce fichier).
   ============================================================================ */

/**
 * Un generateur reproductible a partir d'une graine entiere.
 *
 * ⚠️ `>>> 0` A CHAQUE ETAPE, ET CE N'EST PAS DE LA COQUETTERIE : sans lui,
 * JavaScript passe en flottant au-dela de 2^31 et les deux plateformes
 * divergent au bout de quelques tirages — divergence qui ne se verrait qu'en
 * production, sous la forme de parties honnetes rejetees.
 */
function generateur(graine) {
  let a = (Number(graine) >>> 0) || 1;
  return function suivant() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une graine lisible et transportable : 32 bits, en hexadecimal. */

export { generateur };
