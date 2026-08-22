# Console Play — ce qui est configuré, et ce qui ne peut l'être que là-bas

Audit du **2026-08-21**, fait par l'API (`play_api.py`), pas de mémoire.
Paquet `com.nabil.piratesdice`.

## ✅ Vérifié en place

| Élément | État |
|---|---|
| Accès du compte de service | confirmé, peut ouvrir une édition |
| Langue par défaut | `en-US` |
| Courriel de contact | `n.ouldterki@gmail.com` |
| Site | `https://usernabil.github.io/piratesdice/` |
| Fiche — 4 langues | en-US, fr-FR, es-ES, ar : titre, description courte, description longue |
| Icône 512 | posée |
| Bannière 1024×500 | posée |
| Captures téléphone | **par langue**, 1080×1920 |
| Captures 7″ / 10″ | 1200×1920 / 1300×2080 |
| Notes de version | 4 langues, décrivant les capitaines et les salons |
| Piste interne | version 13 |
| Achats intégrés | aucun (le jeu n'en a pas) |
| Avis | aucun pour l'instant |

## ⛔ Ce que l'API ne peut PAS faire — à faire dans la console

Ce ne sont pas des oublis : ces réglages **n'existent pas** dans l'API de
publication. Chacun a été essayé et refusé, l'erreur est notée.

### 1. Retirer la Corée du Sud du ciblage — **le seul point bloquant**

La piste de test fermé cible **176 pays, Corée comprise** (la piste interne n'a
pas de ciblage : `Track internal does not support country availability`).
Quatre chemins essayés, tous refusés :

| Tentative | Réponse de Play |
|---|---|
| ciblage sur une version `completed` | `Country targeting is only supported for staged releases` |
| ciblage sur un déploiement progressif | `A staged release with country targeting is only supported on the production track` |
| ciblage sur un brouillon | `Country targeting is only supported for staged releases` |
| `countryAvailability` en écriture | la méthode n'existe pas (lecture seule) |

**Chemin console** : Test → Test fermé → la piste → **Pays/régions** → décocher
**Corée du Sud** → Enregistrer → *Aperçu de la publication* → envoyer à la révision.

### 2. Classification du contenu (IARC) — **à vérifier en priorité**

C'est ce qui a déclenché l'avis du 2026-08-20 : le jeu contient un **pari en
pièces**, donc du **jeu d'argent simulé**. L'API ne permet ni de lire ni
d'écrire les réponses au questionnaire.

⚠️ Si le questionnaire répond « non » à la question du jeu d'argent simulé, c'est
plus grave que la Corée : c'est une déclaration inexacte, et ça se corrige avant
toute promotion en production.

### 3. Les autres formulaires « Contenu de l'application »

Aucun n'est exposé par l'API — à passer en revue dans la console :

- **Sécurité des données** (ce que l'app collecte : identifiant d'appareil,
  compte Google, aucune donnée de paiement)
- **Public cible et contenu** (tranche d'âge)
- **Politique de confidentialité** — l'URL doit être renseignée là aussi, pas
  seulement comme site de contact
- **Publicités** : l'app n'en affiche aucune → répondre **non**
- **Application gouvernementale / actualités / COVID** : non

### 4. Testeurs

L'API ne montre que les **groupes Google** d'une piste, et il n'y en a aucun. Une
liste de testeurs saisie en adresses individuelles n'est pas visible d'ici : à
confirmer dans la console. Sans testeurs, une piste fermée ne sert à personne.

### 5. Divers, non exposés par l'API

Catégorie de l'app, tags, coordonnées d'assistance affichées, clé de signature.

## Rappel

La piste de **test fermé porte encore la version 5**, alors que la piste interne
est à la 13. Les testeurs jouent donc un build d'avant les capitaines. Promouvoir
se fait d'une commande, mais c'est une décision de diffusion :

    python play_api.py --promote 13 --track alpha

## Les liens directs de la console (notés le 2026-08-21)

- Compte développeur : `7610471374542677978`
- Application : `4975621758251689754`

L'API de publication ne rend NI l'un NI l'autre : elle ne connaît que le nom de
paquet. Ils viennent de l'URL de la console, donnés par l'admin — d'où le fait de
les écrire ici plutôt que de les redemander à chaque fois.

| Où aller | Lien |
|---|---|
| Test fermé (pistes) | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/tracks/closed-testing |
| **Pays/régions du test fermé** | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/tracks/closed-testing/countries |
| Contenu de l'application | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/app-content |
| Classification du contenu | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/app-content/rating |
| Sécurité des données | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/app-content/data-privacy-security |
| Public cible | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/app-content/target-audience |
| Fiche du store | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/main-store-listing |
| Aperçu de la publication | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/publishing |
| Statut des règles | https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/policy-status |

⚠️ Ces chemins sont ceux de la console actuelle ; si l'un d'eux bouge, partir de
https://play.google.com/console/u/0/developers/7610471374542677978/app/4975621758251689754/app-dashboard.
