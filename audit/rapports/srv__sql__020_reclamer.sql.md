# srv/sql/020_reclamer.sql — LOT 10 #118

Nature : migration SQL (colonne claimed_at + backfill garde). Metrique lot : 1 =
le bloc DO $$ anonyme (compte comme « fonction »). Le fichier contient aussi un
CREATE INDEX. Aucune fonction SQL nommee.

## a) Instructions (unite | ligne)
- DO $$ ... IF NOT EXISTS(column claimed_at) THEN ALTER ADD COLUMN + UPDATE ... $$ | 36
- CREATE INDEX IF NOT EXISTS player_achievement_a_reclamer (partiel) | 52

## b) Analyse
- DO $$ block (backfill garde) | ajoute claimed_at et retro-marque les lignes
  existantes comme deja payees, UNE SEULE FOIS | Le garde-fou est la condition
  `IF NOT EXISTS (... column_name='claimed_at')` : au 1er passage la colonne est
  creee et `UPDATE ... SET claimed_at = unlocked_at` marque comme reclamees les
  lignes deja payees a l'ecriture ; aux redemarrages suivants la colonne existe,
  le bloc est saute. Bloc DO = transaction atomique (ADD COLUMN + UPDATE
  indissociables). Corrige le bug decrit L22-35 : l'ancien `UPDATE ... WHERE
  claimed_at IS NULL` non garde, rejoue a chaque demarrage, volait les
  recompenses en attente. Etat actuel : correct et idempotent. | OK
- CREATE INDEX partiel WHERE claimed_at IS NULL | trouve vite les succes a
  reclamer | Idempotent. | OK

## c) Findings
Aucune faille dans l'etat actuel. Le fichier documente et corrige une ancienne
migration destructive de donnees (marquage « recu » sans paiement, a chaque
redemarrage) ; la version presente est protegee par le test d'existence de
colonne et ne se rejoue pas. A surveiller conceptuellement : la protection
repose sur la seule presence de la colonne — si un futur remaniement recreait la
colonne ou reintroduisait un UPDATE non garde, le vol reapparaitrait. Non
bloquant, pas de faille active.
