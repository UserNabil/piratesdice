# Audit — srv/sql/005_skins_pack.sql

Fichier : `/Users/develop/dice-server/sql/005_skins_pack.sql` — 50 lignes.
Nature : **migration SQL — 0 fonction**. Sème six parures (S002–S007) et **nettoie** l'ancienne parure de démonstration S001 (DELETE inventaire de comptes sondes, puis DELETE du produit sous garde).
Métrique du lot : 0. **Conforme.**

Risques évidents : **aucun de sécurité** (littéraux statiques, pas de secret, pas de shell).

Observation à signaler (donnée / cohérence, faible) : `srv/sql/005_skins_pack.sql:42-46`
```sql
DELETE FROM inventory i
 USING player pl, product p
 WHERE i.player_id = pl.id AND i.product_id = p.id
   AND p.identify = 'S001' AND pl.games = 0
   AND pl.display_name IN ('Sonde', 'AuditParure', 'S', 'Auditeur');
```
La garde repose sur `games = 0` **et** un `display_name` dans une liste. Un vrai joueur nommé `'S'` (nom court plausible) avec 0 partie et qui possèderait S001 verrait son objet supprimé. Probabilité très faible (S001 était une parure de démo interne), et le second DELETE du produit est correctement protégé par `NOT EXISTS (... quantity > 0)`. À classer en nettoyage délibéré, non bloquant ; noté pour traçabilité car un DELETE de données joueur reste sensible.
