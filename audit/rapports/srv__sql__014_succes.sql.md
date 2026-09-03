# srv/sql/014_succes.sql — LOT 10 #112

Nature : migration SQL (schema des succes). Metrique lot : 5 — correspond aux 5
instructions DDL (3 CREATE TABLE + 2 CREATE INDEX). Aucune fonction SQL reelle.

## a) Instructions (unite | ligne)
- CREATE TABLE achievement | 36
- CREATE INDEX achievement_tally_idx | 47
- CREATE TABLE player_achievement | 49
- CREATE INDEX player_achievement_joueur | 56
- CREATE TABLE player_tally | 58

## b) Analyse
- CREATE TABLE achievement | catalogue des succes (id texte, cible, reward) |
  Idempotent. CHECK (reward>=0) sain. | OK
- CREATE INDEX achievement_tally_idx | index partiel WHERE enabled | Idempotent. | OK
- CREATE TABLE player_achievement | succes gagnes (PK joueur+succes) | Idempotent.
  Deux FK ON DELETE CASCADE appropriees. | OK
- CREATE INDEX player_achievement_joueur | Idempotent. | OK
- CREATE TABLE player_tally | compteurs cle/valeur a vie | Idempotent. FK CASCADE. | OK

## c) Findings
Aucune faille. Aucune operation destructive ni defaut dangereux. Migration de
schema pure, idempotente.
