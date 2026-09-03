# Audit — srv/sql/008_replay.sql

Fichier : `/Users/develop/dice-server/sql/008_replay.sql` — 30 lignes.
Nature : **migration SQL — 0 fonction**. Ajoute `match.replay jsonb` (journal de partie) + index partiel `WHERE replay IS NOT NULL`.
Métrique du lot : 1 « fonction ». **Écart attendu** : SQL sans fonction ; l'auto-compteur a probablement compté le `CREATE INDEX ... WHERE ...`. Aucune fonction réelle.

Risques évidents : **aucun**.
- `ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` → idempotent.
- Colonne nullable délibérément (parties antérieures sans journal). Pas de secret, pas d'injection, pas de shell.
- `jsonb` (indexable) plutôt que `json` : choix technique sain.
