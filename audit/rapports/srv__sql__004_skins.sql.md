# Audit — srv/sql/004_skins.sql

Fichier : `/Users/develop/dice-server/sql/004_skins.sql` — 33 lignes.
Nature : **migration SQL — 0 fonction**. Ajoute `player.dice_skin`, la catégorie `Skin` et la parure S001 (obsidienne) via `ON CONFLICT DO UPDATE`.
Métrique du lot : 0. **Conforme.**

Risques évidents : **aucun**.
- Littéraux statiques uniquement → pas d'injection ; aucun secret.
- Idempotent (`ADD COLUMN IF NOT EXISTS`, `ON CONFLICT ... DO NOTHING`/`DO UPDATE`).

Observation (non-risque) : la parure S001 semée ici est ensuite retirée du catalogue par 005_skins_pack.sql (sous garde `games = 0`) — l'ordre des migrations est donc porteur de sens (voir observation dans le rapport de 005).
