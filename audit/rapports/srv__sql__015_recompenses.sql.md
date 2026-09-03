# srv/sql/015_recompenses.sql — LOT 10 #113

Nature : migration SQL (ajout de colonnes). 0 fonction — conforme. 2 ALTER TABLE.

## a) Instructions
- ALTER TABLE achievement ADD COLUMN IF NOT EXISTS reward_gold integer NOT NULL DEFAULT 0 | 18
- ALTER TABLE achievement ADD COLUMN IF NOT EXISTS reward_item text | 19

## b) Analyse
- ADD COLUMN reward_gold | or rapporte par un succes | Idempotent (IF NOT
  EXISTS). NOT NULL avec DEFAULT 0 : sur : les lignes existantes prennent 0. | OK
- ADD COLUMN reward_item | id produit offert (nullable) | Idempotent. Absence
  volontaire de FK vers product (documentee L21-24) : un id disparu n'echoue pas
  la migration, l'existence est verifiee au moment de donner. Choix defendable,
  pas un defaut dangereux au niveau SQL. | OK

## c) Findings
Aucune faille. Pas de DROP/DELETE, pas de donnee sensible.
