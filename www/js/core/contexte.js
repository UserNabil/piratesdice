/* ============================================================================
   core/contexte.js — LA PILE DES CONTEXTES, ET LE SEUL SENS DU BOUTON RETOUR.

   ⛔ LE RETOUR NATIF FERMAIT N'IMPORTE QUOI. Chaque modale posait — ou oubliait
   de poser — son propre ecouteur `pd-back` : les regles, le butin et la pause
   n'en avaient AUCUN (retour = accueil, par-dessus la modale ouverte), les
   reglages s'armaient en `{once:true}` qu'un retour etranger consommait, et
   l'ordre d'enregistrement decidait du vainqueur. « Des fois je fais un retour
   et ca me ramene a l'accueil alors que c'est cense juste retirer la modale. »

   UNE PILE, UNE REGLE. Tout ce qui s'ouvre PAR-DESSUS l'ecran s'inscrit ici en
   s'ouvrant et s'en retire en se fermant. Le bouton RETOUR ferme LE DESSUS DE
   LA PILE, rien d'autre ; la pile vide, il retrouve ses sens d'avant (page ->
   accueil, carte de fin -> pont, sinon l'application se range).

   L'inscription rend une poignee :
     const ctx = ouvrirContexte('pause', fermer);
     ... ctx.retirer()  — a appeler dans SA fermeture manuelle, pour ne pas
                          laisser une entree morte dans la pile.
   `retourContexte()` (appele par boot.js AVANT tout le reste) depile et ferme.
   ============================================================================ */

const pile = [];

export function ouvrirContexte(nom, fermer) {
  const entree = { nom, fermer };
  pile.push(entree);
  return {
    retirer() {
      const i = pile.indexOf(entree);
      if (i >= 0) pile.splice(i, 1);
    },
  };
}

/** Ferme le contexte du dessus. Rend true si un contexte a ete consomme. */
export function retourContexte() {
  const entree = pile.pop();
  if (!entree) return false;
  try { entree.fermer(); } catch (e) { console.error('[contexte]', entree.nom, e); }
  return true;
}

/** Pour les curieux et les tests : la profondeur de la pile. */
export function profondeurContextes() {
  return pile.length;
}
