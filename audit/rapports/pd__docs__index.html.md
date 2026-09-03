# Audit — pd/docs/index.html (14 lignes)

**0 fonction — page HTML statique de redirection.** Redirige (canonical + meta-refresh + `location.replace`) vers `https://usernabil.github.io/piratesdice-site/`.

## Risques évidents

- **Injection : aucune.** URL de destination codée en dur, en HTTPS, sans aucune entrée utilisateur interpolée. `location.replace("https://usernabil.github.io/piratesdice-site/")` est une constante littérale.
- **Secrets : aucun.**
- Pas de commande dangereuse, pas d'`eval`, pas de handler dynamique.
- Triple redirection (link canonical, `meta http-equiv=refresh`, JS) : redondance volontaire pour couvrir JS désactivé. Sans risque.

**Verdict : OK** (HTML statique de redirection).
