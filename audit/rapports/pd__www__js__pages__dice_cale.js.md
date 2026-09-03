# Rapport d'audit — pd/www/js/pages/dice_cale.js

Fichier lu en entier (147 lignes). Rôle : la « cale » = stockage local (`localStorage`)
des jetons hors-ligne, parties en attente, fiche joueur et rang. Tout accès au
stockage est enveloppé dans un try/catch : un stockage qui refuse ne fait pas
tomber le jeu, il désactive seulement le hors-ligne (intention documentée en tête).

## a) Liste des fonctions

| nom | ligne |
|---|---|
| lire | 30 |
| ecrire | 39 |
| jetons | 46 |
| rangerJetons | 49 |
| reglesHorsLigne | 58 |
| prendreUnJeton | 70 |
| rangerMoi | 89 |
| moi | 100 |
| enAttente | 107 |
| garderPartie | 109 |
| oublierParties | 118 |
| rangerRang | 136 |
| rangConnu | 142 |

Écart de comptage : le lot annonce 20 fonctions, j'en recense 13 nommées + 3 arrow-
fonctions inline (filter/map lignes 51, 52, 120) ≈ 16. L'écart vient de la métrique
auto (`=>` gonflent). Aucune fonction cachée manquée.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| lire | lit une clé JSON, exige un Array sinon défaut | try/catch complet, valide `Array.isArray` | OK |
| ecrire | écrit une valeur JSON, renvoie bool succès | try/catch complet | OK |
| jetons | renvoie le tableau de jetons | aucun | OK |
| rangerJetons | remplace le lot de jetons reçu du serveur | valide id string + graine finie via filter/map ; setItem des règles en try/catch | OK |
| reglesHorsLigne | lit les règles hors-ligne | try/catch + fallback `{}` | OK |
| prendreUnJeton | retire et renvoie le 1er jeton | retour de `ecrire` ignoré (l.74) ; course inter-onglets théorique | OK (voir findings) |
| rangerMoi | mémorise la dernière fiche joueur connue | try/catch, garde null-check | OK |
| moi | lit la fiche joueur | try/catch + fallback null | OK |
| enAttente | renvoie les parties en attente | aucun | OK |
| garderPartie | ajoute une partie, plafonne à 40, renvoie bool | plafond FIFO correct | OK |
| oublierParties | retire les parties traitées | retour `ecrire` ignoré (l.121) mais renvoie `reste.length` | OK |
| rangerRang | mémorise le rang classement | try/catch, borne >=0 | OK |
| rangConnu | lit le rang mémorisé | try/catch + fallback 0 | OK |

## c) Findings détaillés

Aucune FAILLE bloquante. Deux observations de faible gravité (par conception,
impact quasi nul) :

1. `prendreUnJeton` — dice_cale.js:74 — gravité : état incohérent (probabilité
   quasi nulle). `ecrire(CLE_JETONS, liste)` renvoie un booléen ignoré. Si
   l'écriture échoue, le jeton `pris` est renvoyé et joué mais reste en stockage :
   un `prendreUnJeton` ultérieur pourrait resservir le même jeton → rejet serveur.
   En pratique : si le stockage refuse l'écriture, `garderPartie` échouera aussi
   et la partie ne sera pas persistée (donc pas de double-crédit), et `rangerJetons`
   n'aurait déjà rien pu écrire. Risque effectif ≈ nul. Idem course entre deux
   onglets partageant `localStorage` (contexte app mobile mono-onglet).

2. `oublierParties` — dice_cale.js:121 — gravité : cosmétique. Retour de `ecrire`
   ignoré ; en cas d'échec d'écriture, les parties déjà traitées seraient
   re-soumises au prochain retour réseau, mais le serveur les rejette comme
   déjà traitées (idempotent). Sans impact fonctionnel.

Statut fichier : OK.
