# Publier et gérer l'application — ce qu'il me faut, et ce que je fais

Vous avez déjà `com.myofficeapps.utrav` et `com.utrav.app` en production : la
mécanique vous est connue. Ce document ne redit donc que **ce qui me manque pour
faire le travail à votre place**, et ce que je prends en charge une fois que je
l'ai.

---

## 1. Ce que je ne peux PAS faire, et que vous seul pouvez faire

L'API Google Play Publishing gère les *versions* et la *fiche* d'une application
**qui existe déjà**. Elle ne sait ni créer l'application, ni accepter des
conditions, ni remplir un questionnaire. Ces quatre gestes sont à vous — comptez
dix minutes en tout.

**a. Créer l'application** dans la console :
- Nom : `The Pirate's Dice`
- Langue par défaut : anglais (US)
- Type : **Jeu** · Gratuit
- ⚠️ Le nom de paquet **`com.nabil.piratesdice`** se fixe au premier envoi d'AAB
  et **ne se change plus jamais**. C'est le seul point sans retour.

**b. Me créer un compte de service** (c'est la clé de tout le reste) :
1. Google Cloud Console → un projet (le vôtre ou un neuf) → **Activer l'API
   « Google Play Android Developer API »**.
2. IAM → **Comptes de service** → en créer un (`pirates-dice-publisher`) →
   **Clés** → *Ajouter une clé* → **JSON** → le fichier se télécharge.
3. Play Console → **Utilisateurs et autorisations** → *Inviter un utilisateur* →
   coller l'adresse du compte de service → l'autoriser sur **cette application**
   avec : *Afficher les informations*, **Gérer les versions de production**,
   **Gérer les versions de test**, **Modifier la fiche Play Store*.

👉 **Donnez-moi le fichier JSON** (dites-moi où vous le posez, je l'range dans
`.secrets.json` — il ne partira jamais dans le dépôt).

**c. Play Games Services** — c'est ce qui fait la connexion automatique au compte
Google. Console → **Play Games Services** → *Configuration et gestion* → créer un
projet, le lier à l'application, puis créer deux identifiants OAuth :
- un client **Android** (il demandera l'empreinte SHA-1 : je vous la donne dès que
  la clé de signature est faite, voir §2) ;
- un client **Web** — c'est celui dont **le serveur** a besoin pour vérifier
  l'identité.

👉 **Donnez-moi l'identifiant du client Web et son secret**, plus l'**ID du projet
Games**.

**d. Le questionnaire** de classification du contenu et le formulaire « Sécurité
des données ». Les réponses exactes sont déjà rédigées dans `LISTING.md` §3 : il
n'y a qu'à recopier. Le point qui compte : **« jeux d'argent » = NON** (les pièces
ne s'achètent pas et ne se convertissent pas) — répondre oui ferait basculer la
fiche dans une catégorie autrement contraignante.

## 2. La signature

Je recommande **Play App Signing** (le défaut) : Google garde la clé de signature
finale, vous ne pouvez pas la perdre. Moi je fabrique la **clé d'envoi** :

```bash
keytool -genkeypair -v -keystore pirates-dice-upload.jks -alias upload \
        -keyalg RSA -keysize 4096 -validity 10000
```

👉 Il me faut de vous : **le mot de passe** que vous voulez pour cette clé (ou je
le tire au hasard et je vous le donne). Le fichier `.jks` reste hors du dépôt ; je
vous dirai où il est, **à sauvegarder ailleurs qu'ici**.

## 3. Ce que je prends en charge une fois que j'ai tout ça

| | |
|---|---|
| Construire l'AAB signé | `./gradlew bundleRelease` |
| Envoyer une version | API Publishing v3 : piste **internal** → **closed** → **production** |
| La fiche (4 langues) | titres, descriptions, captures, bannière — par l'API |
| Les icônes | déjà générées depuis votre logo (136 fichiers, toutes densités) |
| La politique de confidentialité | rédigée **et hébergée** par mes soins sur votre R2/Cloudflare |
| Les notes de version | à chaque livraison |
| Le suivi | plantages, avis, taux d'installation : lisibles par l'API |

## 4. L'ordre dans lequel ça se déroulera

1. Vous : créer l'app + le compte de service (§1a, §1b) → me donner le JSON.
2. Moi : clé d'envoi, AAB signé, **piste interne** — vous l'installez depuis Play
   sur votre téléphone. C'est le premier vrai test.
3. Vous : SHA-1 en main, créer les clients OAuth (§1c) → me donner le client Web.
4. Moi : brancher la connexion Google, republier en interne, revérifier.
5. Vous : questionnaires (§1d). Moi : fiche complète, captures, politique en ligne.
6. Ensemble : passage en production quand vous le dites.

## 5. Les délais qui ne dépendent de personne

- Un **compte développeur récent** peut exiger **12 testeurs pendant 14 jours**
  en piste fermée avant d'autoriser la production. Votre compte a déjà deux
  applications publiées : cette contrainte ne devrait pas s'appliquer, mais la
  console le dira.
- Chaque envoi passe une revue : quelques heures à trois jours.

---

## Retirer un pays du ciblage — ça ne passe PAS par l'API (2026-08-21)

Google a signalé le 2026-08-20 que l'app **simule un jeu d'argent** (l'écran de mise)
et l'a retirée de **Corée du Sud**. L'app reste approuvée partout ailleurs ; seule la
Corée est concernée, et l'avis reste 90 jours sur la page « Statut des règles ».

**Ce qui a été vérifié, mesure à l'appui :**

| Piste | Ciblage pays |
|---|---|
| `internal` | `400 Track internal does not support country availability` — la piste interne n'a pas de ciblage, elle n'est donc pas la cause |
| `alpha` (test fermé) | **176 pays**, `restOfWorld=true`, **KR inclus** — c'est là que ça se joue |
| `production` | vide (l'app n'y est pas encore) |

**L'API de publication ne sait pas le corriger.** `countryAvailability` est en
**lecture seule** (pas de méthode d'écriture), et poser `countryTargeting` sur la
version d'une piste est refusé :

```
400 Country targeting is only supported for staged releases.
```

Une version `completed` n'accepte donc aucun ciblage. Une commande `--untarget` a été
écrite puis **retirée** : livrer une commande qui échoue est pire que ne rien livrer.

**Le seul chemin : la console.**
Play Console → *Test* → *Test fermé* → la piste → onglet **Pays/régions** → décocher
**Corée du Sud** → *Enregistrer* → *Aperçu de la publication* → envoyer à la révision.

⚠️ **Le point qui compte davantage pour la production** : le questionnaire de
**classification du contenu** doit déclarer le **jeu d'argent simulé**. L'API ne permet
pas de lire la réponse donnée. Si elle est « non », c'est un problème plus sérieux que
la Corée — à vérifier avant toute promotion en production.
