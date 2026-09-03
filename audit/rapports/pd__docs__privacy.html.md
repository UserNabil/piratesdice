# Audit — pd/docs/privacy.html (14 lignes)

**0 fonction — page HTML statique de redirection.** Identique à `docs/index.html`, redirige vers `https://usernabil.github.io/piratesdice-site/privacy`.

## Risques évidents

- **Injection : aucune.** URL de destination codée en dur en HTTPS, aucune entrée utilisateur. `location.replace("https://usernabil.github.io/piratesdice-site/privacy")` littéral.
- **Secrets : aucun.**
- Pas d'`eval`, pas de commande dangereuse, pas de handler dynamique.

**Verdict : OK** (HTML statique de redirection).
