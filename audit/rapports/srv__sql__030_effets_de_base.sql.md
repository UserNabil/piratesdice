# srv/sql/030_effets_de_base.sql

0 fonction — migration SQL de DONNEE (2 UPDATE), rejouable.
Ecart avec le lot (nb_fonctions=0) : conforme.

## Contenu
- `UPDATE product SET enabled=false WHERE category_id IN (...) AND identify NOT IN ('B002','B003')` (l.12-14)
- `UPDATE product SET enabled=true WHERE identify IN ('B002','B003')` (l.16-17)

## Risques
- Valeurs litterales, aucune entree client : pas d'injection.
- Idempotent. Ne supprime rien (les inventaires existants demeurent). OK.

## Statut : OK
