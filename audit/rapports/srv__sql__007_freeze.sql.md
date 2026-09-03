# Audit — srv/sql/007_freeze.sql

Fichier : `/Users/develop/dice-server/sql/007_freeze.sql` — 35 lignes.
Nature : **migration SQL — 0 fonction**. Sème l'effet B006 (« geler le prochain tour ») via `ON CONFLICT DO UPDATE` puis `UPDATE ... enabled = true`.
Métrique du lot : 0. **Conforme.**

Risques évidents : **aucun**.
- Littéraux statiques, aucun secret, aucune commande shell.
- Idempotent (`ON CONFLICT (identify) DO UPDATE`, `UPDATE` ciblé sur B006).
