# Ce qu'il me faut, dans l'ordre — 20 minutes de votre côté

Vous avez déjà : l'application créée dans la console (`4975621758251689754`), le
compte de service `claude-api-key-654@pirates-dice-506116.iam.gserviceaccount.com`,
et le logo. **Il manque quatre choses**, et rien d'autre.

De mon côté, tout est prêt : l'AAB **signé** se construit (31,6 Mo), la clé
d'envoi existe, le workflow GitHub est écrit, la fiche est rédigée en quatre
langues.

---

## Étape 1 — La clé JSON du compte de service ⏱ 3 min

Le compte existe ; il me faut **sa clé**, sans quoi je ne peux rien envoyer.

1. <https://console.cloud.google.com/> → projet **pirates-dice-506116**
2. **IAM et administration → Comptes de service**
3. Cliquer sur `claude-api-key-654@…`
4. Onglet **Clés** → *Ajouter une clé* → **Créer une clé** → **JSON** → Créer
5. Un fichier `pirates-dice-506116-xxxxx.json` se télécharge.

👉 **Posez-le dans `C:\Users\nould\Downloads\` et dites-le moi.** Je le range
dans `.secrets.json` (jamais dans git) et je m'en sers pour publier.

⚠️ Google ne le remontre jamais. Si vous le perdez, on en refait une autre.

## Étape 2 — Activer l'API ⏱ 1 min

Dans le **même projet** `pirates-dice-506116` :

<https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com>
→ **Activer**

Sans ça, la clé est valide mais Google répond « API non activée ».

## Étape 3 — Inviter le compte de service dans Play Console ⏱ 4 min

Vous l'avez déjà fait pour `release-manager@utrav-455707` : c'est le même geste.

1. <https://play.google.com/console/u/0/developers/7610471374542677978/users-and-permissions>
2. **Inviter de nouveaux utilisateurs**
3. Adresse : `claude-api-key-654@pirates-dice-506116.iam.gserviceaccount.com`
4. **Autorisations par application** → cocher **The Pirate's Dice** uniquement
5. Cocher ces quatre droits, pas plus :
   - *Afficher les informations sur l'application*
   - *Gérer les versions de test*
   - **Gérer les versions de production**
   - *Modifier la fiche du Play Store*
6. Inviter.

## Étape 4 — Le dépôt GitHub et mon accès ⏱ 8 min

Le dépôt <https://github.com/UserNabil/piratesdice> doit exister (vide, sans
README — je pousse tout).

**Puis, au choix — le plus simple d'abord :**

### Option A (recommandée) : un jeton pour moi

<https://github.com/settings/personal-access-tokens/new>

- Nom : `claude-agent-piratesdice`
- *Resource owner* : **UserNabil**
- *Repository access* : **Only select repositories** → `piratesdice`
- *Permissions → Repository* :
  - **Contents** : Read and write
  - **Workflows** : Read and write
  - **Secrets** : Read and write
  - **Actions** : Read and write
  - **Metadata** : Read (coché tout seul)
- Expiration : 90 jours

👉 **Donnez-moi ce jeton.** Avec lui je pousse le code, je crée le workflow **et
je pose les cinq secrets tout seul** — vous n'avez plus rien à faire.

### Option B : vous gardez la main

1. Dépôt → *Settings → Deploy keys → Add deploy key*, **Allow write access**,
   et coller :

   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIETZOeaX5mkrPOrKdq15etcdle4sgDohlR+TpjPR8u/o claude-agent@piratesdice
   ```

2. *Settings → Secrets and variables → Actions* : créer les cinq entrées listées
   dans **`signing/github-secrets.txt`** (sur cette machine — les valeurs y sont
   déjà écrites, il n'y a qu'à copier-coller).

---

## Ce qui se passera ensuite, sans vous

1. Je pousse le dépôt (application + workflow + fiche).
2. La première poussée **déclenche le workflow** : AAB signé → **piste interne**.
3. Vous recevez l'application par Play, sur votre téléphone, comme un vrai
   installeur — c'est le premier test grandeur nature.
4. Je remplis la fiche (4 langues), les captures et les icônes par l'API.
5. Vous répondez aux deux questionnaires (contenu, sécurité des données) : les
   réponses exactes sont déjà écrites dans `LISTING.md` §3.
6. Passage en production **quand vous le dites**.

## Les deux choses que je ne pourrai pas faire seul

- **La connexion Google du jeu** (Play Games Services) exige une empreinte que
  Google ne délivre **qu'après le premier envoi** : la console affichera alors
  la clé de signature de l'application (*Configuration → Intégrité de l'app*).
  Je vous dirai précisément quoi copier pour créer les deux clients OAuth. En
  attendant, l'application marche en **compte invité**.
- **Le tunnel du serveur** : il me faut le jeton Cloudflare (voir
  `PLAY_DEPLOY.md`). Sans lui l'application ne joint le serveur qu'en Wi-Fi du
  bureau — donc à faire **avant** d'ouvrir la piste interne à d'autres testeurs.

## Ce que la clé de signature devient

`signing/piratesdice-upload.jks` sur cette machine, hors de git. C'est la clé
d'**envoi** : Play garde la vraie clé de signature (Play App Signing). La perdre
se répare en quelques clics ; la laisser fuiter, non. **Sauvegardez le dossier
`signing/` ailleurs qu'ici** — c'est le seul fichier de tout ce chantier qui ne
se reconstruit pas.

Son empreinte, si un formulaire la demande :
`SHA-256 : 8B:39:41:41:B5:5F:E2:19:ED:B5:8D:D3:75:05:CF:67:EF:1E:10:E0:26:5E:33:51:10:42:AA:96:03:0B:7A:96`

## Et l'intégrité Play (le JSON que vous avez collé) ?

C'est l'API **Play Integrity** : elle sert à vérifier que l'application n'a pas
été trafiquée. **Elle n'est pas nécessaire pour publier**, et je ne l'ai pas
branchée : elle demande une vérification côté serveur à chaque partie, pour un
jeu où il n'y a rien à voler. À garder pour plus tard, si le classement devient
un enjeu.
