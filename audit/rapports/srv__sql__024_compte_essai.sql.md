# srv/sql/024_compte_essai.sql

0 fonction — migration SQL de DONNEE (UPDATE + INSERT), rejouee a chaque demarrage.
Ecart avec le lot (nb_fonctions=0) : conforme.

## Contenu
- `UPDATE player SET games = GREATEST(games,600) WHERE pseudo='sea-18808be18ff0dcd4'` (l.28-30)
- `INSERT INTO player_achievement ... SELECT ... CROSS JOIN achievement ... ON CONFLICT DO NOTHING` (l.38-44)

## Risques
- Requetes NON parametrees mais valeurs LITTERALES et fixes (pas d'entree client) : pas d'injection.
- Idempotence OK : `GREATEST` ne fait pas redescendre, `ON CONFLICT DO NOTHING` ne re-donne pas un haut fait.

## Finding — risque evident (non-code)
`srv/sql/024_compte_essai.sql:28` et `:38` — gravite : etat incoherent / compte privilegie.
Ce fichier ouvre EN GRAND un compte de test nomme en dur (`sea-18808be18ff0dcd4`,
device de dev) : 600 parties (debloque les 10 capitaines + les 11 effets boutique)
et les 100 hauts faits, et il est REJOUE a chaque deploiement. L'en-tete le documente
et demande de le retirer (« ⛔ A RETIRER LE JOUR OU CE TELEPHONE N'EST PLUS UN BANC
D'ESSAI »). Tant qu'il reste, tout deploiement re-privilegie cet identifiant ; s'il
est oublie il devient un compte avantage que plus personne n'explique. Ce n'est pas
une faille de code (donnee intentionnelle, documentee) mais un risque a signaler.

## Statut : OK (risque signale : compte de test privilegie laisse dans le chemin de deploiement)
