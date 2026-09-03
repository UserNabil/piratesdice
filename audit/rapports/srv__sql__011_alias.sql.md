# srv/sql/011_alias.sql — LOT 10 #109

Nature : migration SQL (DDL + backfill). Metrique lot : 2 « fonctions ». SQL n'a
pas de fonctions ; l'outil a compte les 2 instructions DDL (CREATE TABLE,
CREATE INDEX). Le fichier contient 3 instructions au total. Ecart signale, sans
blocage.

## a) Instructions (unite | ligne)
- CREATE TABLE IF NOT EXISTS player_alias | 21
- CREATE INDEX IF NOT EXISTS player_alias_joueur | 27
- INSERT INTO player_alias SELECT pseudo,id FROM player ON CONFLICT DO NOTHING | 30

## b) Analyse
- CREATE TABLE player_alias | cree la table des alias de compte | Idempotent
  (IF NOT EXISTS). FK player_id ON DELETE CASCADE : la suppression d'un joueur
  emporte ses alias, comportement voulu. Aucun defaut dangereux. | OK
- CREATE INDEX player_alias_joueur | index sur player_id | Idempotent. | OK
- INSERT ... SELECT pseudo | backfill : chaque joueur existant recoit son pseudo
  comme premier alias | Verifie : player.pseudo est `NOT NULL UNIQUE`
  (001_schema.sql:3), donc aucune collision d'alias entre deux joueurs a
  l'insertion ; le `ON CONFLICT (alias) DO NOTHING` ne perd donc aucune ligne au
  premier passage et rend l'instruction idempotente aux redemarrages. Pas de
  DELETE/DROP, pas de reecriture de player.pseudo. | OK

## c) Findings
Aucune faille. Aucune operation destructive, aucun defaut dangereux, aucune
donnee sensible. Migration idempotente.
