# Audit — srv/sql/001_schema.sql

Fichier : `/Users/develop/dice-server/sql/001_schema.sql` — 90 lignes.
Nature : **migration SQL — 0 fonction**. Schéma initial : tables `player`, `product_category`, `product`, `inventory`, `match`, index, et données de départ (catégories + 5 effets B001–B005) via `INSERT ... ON CONFLICT DO UPDATE`.
Métrique du lot : 8 « fonctions ». **Écart attendu** : un fichier SQL n'a pas de fonction ; l'auto-compteur a compté les 5 `CREATE TABLE` + 3 `CREATE INDEX` (ou les blocs `INSERT`). Aucune fonction réelle.

Risques évidents (injection / secret / commande dangereuse) : **aucun**.
- Aucune donnée dynamique : toutes les valeurs semées sont des littéraux statiques → pas d'injection.
- Aucun secret en clair.
- Idempotent : `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT (name/identify) DO ...` → rejouable sans dommage (le migrate.js rejoue tout).
- Intégrité : `CHECK (>= 0)` sur les compteurs monétaires, FK `ON DELETE CASCADE`/`SET NULL` cohérentes.

Observation (non-risque) : `product.basic_price`/`premium_price` sont nullable (pas de `NOT NULL`) — délibéré (les ornements légendaires n'ont pas de prix, cf. 010_prix.sql).
