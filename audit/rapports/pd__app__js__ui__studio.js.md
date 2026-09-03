# Audit — pd/app/js/ui/studio.js (100 lignes)

Fichier lu EN ENTIER. Lot annonce **8 fonctions** ; **4 nommées** trouvées. Outil de DÉVELOPPEMENT (aperçu piloté par l'atelier sur le Mac, via localhost/10.0.2.2).

## (a) Fonctions

| nom | ligne |
|---|---|
| appliquer(vars) | 38 |
| demander() async | 53 |
| chercherAtelier() async | 70 |
| brancherStudio() (export async) | 88 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| appliquer | pose/retire des variables CSS reçues de l'atelier | garde `!wrap` ; nettoie les propriétés disparues ; `setProperty(nom, vars[nom])` depuis le serveur — voir note | OK |
| demander | interroge `/etat`, applique si version changée | try/catch ; compteur d'échecs → `clearInterval` à `ECHECS_MAX` (auto-arrêt) ; `d.vars||{}` | OK |
| chercherAtelier | trouve l'atelier (2 hôtes), 1 essai chacun | try/catch par hôte → jamais de rejet ; null si absent | OK |
| brancherStudio | branche l'aperçu si un atelier répond | `!base`→false (pas d'intervalle posé) ; `await demander()` avant l'intervalle | OK |

## (c) Findings

- **studio.js:49 | cosmétique (dev-only)** | `wrap.style.setProperty(nom, vars[nom])` applique des clés/valeurs CSS venant de la réponse serveur. C'est au plus une injection de style CSS, MAIS la cible est exclusivement `localhost`/`10.0.2.2` (atelier de dev local, de confiance) et l'auto-arrêt après 3 échecs empêche tout coût en production (personne ne répond à localhost sur un vrai téléphone). Pas de risque réel.
- Ressources (point 6) : `setInterval(demander, PERIODE)` (l.92) n'est arrêté que par la voie des échecs ; en dev, s'il répond toujours, il tourne pour la vie de la page — acceptable pour un outil de dev.

**Verdict : OK** (outil de dev, localhost, auto-limité).
