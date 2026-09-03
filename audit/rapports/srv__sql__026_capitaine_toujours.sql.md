# srv/sql/026_capitaine_toujours.sql

0 fonction — migration SQL schema+donnee (ALTER + UPDATE), rejouable.
Ecart avec le lot (nb_fonctions=0) : conforme.

## Contenu
- `ALTER TABLE player ALTER COLUMN captain SET DEFAULT 'read'` (l.31)
- `UPDATE player SET captain='read' WHERE captain IS NULL` (l.33)

## Risques
- Aucune entree client, valeurs litterales : pas d'injection.
- Idempotent (l'UPDATE ne touche que les NULL restants) : rejouable sans effet de bord.

## Statut : OK
