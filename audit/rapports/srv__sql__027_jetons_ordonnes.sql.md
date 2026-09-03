# srv/sql/027_jetons_ordonnes.sql

0 fonction PL/pgSQL — migration SQL schema+donnee (CREATE SEQUENCE / ALTER / UPDATE / CREATE INDEX).
Ecart avec le lot : le lot annonce nb_fonctions=1 ; il n'y a AUCUNE fonction (la
metrique auto a probablement compte `nextval(...)`). Recompte manuel : 0 fonction.

## Contenu
- `CREATE SEQUENCE IF NOT EXISTS offline_ticket_rang_seq` (l.30)
- `ALTER TABLE offline_ticket ADD COLUMN IF NOT EXISTS rang bigint` (l.32) + DEFAULT nextval (l.33-34)
- `UPDATE offline_ticket SET rang=nextval(...) WHERE rang IS NULL` (l.38-39)
- `CREATE INDEX IF NOT EXISTS offline_ticket_ordre ON offline_ticket(player_id,used_at,rang)` (l.41-42)

## Risques
- Aucune entree client : pas d'injection.
- Idempotent : `IF NOT EXISTS` partout, l'UPDATE ne touche que `rang IS NULL`. Rejouable.

## Statut : OK
