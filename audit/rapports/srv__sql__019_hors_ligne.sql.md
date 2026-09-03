# srv/sql/019_hors_ligne.sql — LOT 10 #117

Nature : migration SQL (table des jetons hors ligne). Metrique lot : 2 =
CREATE TABLE + CREATE INDEX. Aucune fonction SQL reelle.

## a) Instructions (unite | ligne)
- CREATE TABLE IF NOT EXISTS offline_ticket | 16
- CREATE INDEX IF NOT EXISTS offline_ticket_joueur | 28

## b) Analyse
- CREATE TABLE offline_ticket | table anti-rejeu des parties hors ligne (id PK,
  seed, used_at, refus) | Idempotent. La PK sur `id` est la garantie anti-rejeu
  (un jeton consomme ne peut etre rejoue). FK player_id ON DELETE CASCADE
  appropriee. La colonne `seed` (graine serveur) est stockee en base : c'est une
  donnee de jeu, pas un secret d'authentification ; sa presence en base est
  necessaire au controle du tirage au retour. Aucun secret/mot de passe/cle en
  clair. Le plafond quotidien anti-farm est decrit en commentaire mais applique
  dans le code (hors de ce fichier). | OK
- CREATE INDEX offline_ticket_joueur | index (player_id, used_at) | Idempotent. | OK

## c) Findings
Aucune faille. Pas de DROP/DELETE, pas de secret en clair. Migration de schema
idempotente. Le mecanisme anti-rejeu (PK) et anti-triche (graine serveur) est
sain au niveau du schema ; l'application des regles reste a verifier cote code
(hors lot).
