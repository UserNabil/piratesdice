# Audit — srv/sql/003_captains.sql

Fichier : `/Users/develop/dice-server/sql/003_captains.sql` — 3 lignes.
Nature : **migration SQL — 0 fonction**. Ajoute la colonne `player.captain` (capitaine choisi).
Métrique du lot : 0. **Conforme.**

Risques évidents : **aucun**.
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` → idempotent, rejouable à chaque déploiement (comme le note le commentaire).
- Aucune donnée dynamique, aucun secret, aucune commande dangereuse.
