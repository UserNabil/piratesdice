# Le parcours, de maintenant à la production

**Fait, et automatique désormais** : dépôt GitHub, workflow, AAB signé, envoi sur
la piste interne (versionCode 3), fiche en quatre langues, icône, bannière, six
captures. Une poussée sur `main` refait tout ça toute seule.

Il reste **quatre gestes**, dans cet ordre. Trois sont à vous — ce sont ceux que
l'API de Google ne sait pas faire.

---

## ① Le tunnel, pour que le jeu marche hors du bureau ⏱ 5 min (vous), puis moi

Aujourd'hui l'application parle à `192.168.1.19:8100` : **elle ne fonctionne
qu'en Wi-Fi du bureau**. C'est le seul point qui empêche de donner l'application
à un testeur.

Deux façons, prenez la première :

**A. Me donner un jeton d'API Cloudflare** — je fais tout le reste (créer le
tunnel, le DNS `dice.edenreforged.com`, installer le connecteur sur la machine
de jeu, rebâtir l'app, republier).

<https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → *Custom token*

| | |
|---|---|
| Nom | `claude-agent-tunnel` |
| Permissions | **Account · Cloudflare Tunnel · Edit** |
| | **Zone · DNS · Edit** |
| Ressources | Account = le vôtre · Zone = `edenreforged.com` |

**B. Créer le tunnel vous-même** dans *Zero Trust → Networks → Tunnels*, type
**Cloudflared**, hostname public `dice.edenreforged.com` → `http://localhost:8100`,
et me donner **le jeton du tunnel**. Je pose le connecteur avec
`python dice_server/deploy/tunnel.py --install <jeton>` (binaire autonome, aucun
`apt` — un `apt` sur cette machine ferait tomber les serveurs de jeu).

## ② La connexion Google du jeu ⏱ 10 min (vous)

Il faut deux identifiants OAuth, et Google exige l'empreinte de la **clé de
signature de l'application** — celle que Play a générée, **pas la mienne**.

1. **Relever l'empreinte** : Play Console → *Test et versions → Configuration →
   Intégrité de l'application* → bloc **Certificat de clé de signature de
   l'application** → copier le **SHA-1**.
2. **Client Android** : <https://console.cloud.google.com/apis/credentials>
   (projet `pirates-dice-506116`) → *Créer des identifiants → ID client OAuth* →
   type **Android** → nom de package `com.nabil.piratesdice` → coller le SHA-1.
3. **Client Web** : même écran → *ID client OAuth* → type **Application Web** →
   nom `pirates-dice-server`.
4. **Play Games Services** : Play Console → *Développer → Play Games Services →
   Configuration et gestion → Configuration* → créer, lier l'application, et
   attacher les deux identifiants créés.

👉 **Donnez-moi l'ID du client Web et son secret.** Je les pose sur le serveur
(`DICE_GOOGLE_CLIENT_ID` / `DICE_GOOGLE_CLIENT_SECRET`) et la connexion
automatique s'allume. Sans eux, l'application tourne en **compte invité** —
elle marche, mais le joueur n'est pas rattaché à son compte Google.

## ③ Les deux questionnaires ⏱ 10 min (vous)

Play les rend obligatoires, et aucune API ne les remplit.

- **Classification du contenu** : questionnaire → réponses dans `LISTING.md` §3.
  Le point qui compte : **« jeux d'argent » = NON** (les pièces ne s'achètent pas
  et ne se convertissent pas). Répondre oui ferait basculer la fiche dans une
  catégorie autrement contraignante.
- **Sécurité des données** : tableau prêt dans `LISTING.md` §3 également.
- **Accès à l'application** : répondre *« Toutes les fonctionnalités sont
  disponibles sans accès particulier »* — la connexion est automatique.
- **Public cible** : 13 ans et plus (jeu social en ligne, sans chat).
- **Politique de confidentialité** : URL obligatoire. Je la rédige et je
  l'héberge sur votre R2 dès que vous me le dites — c'est cinq minutes.

## ④ Les testeurs de la piste interne ⏱ 2 min (vous)

Play Console → *Test → Test interne → Testeurs* → créer une liste avec votre
adresse (et celles des testeurs). Vous recevez un lien d'inscription ; ensuite
l'application s'installe **depuis le Play Store**, comme la vraie.

---

## Ce que je fais dès que j'ai ① et ②

```
python dice_server/deploy/tunnel.py --install <jeton>     # le serveur devient public
python dice_server/deploy/deploy.py                       # avec les identifiants Google
# variable DICE_SERVER_URL dans le depot GitHub, puis une poussee suffit :
#   AAB signe -> piste interne -> vous l'avez sur le telephone
```

## Ce qui tourne déjà tout seul

| Geste | Effet |
|---|---|
| `git push` sur `main` | AAB signé → piste **interne** |
| Workflow manuel, piste au choix | interne / alpha / bêta / **production** |
| `python play_api.py --listing` | refait la fiche et ses images |
| `python play_api.py --check` | dit ce que Play voit, et **pourquoi** un accès échoue |
| `python play_api.py --upload x.aab --track internal` | envoi à la main si besoin |

## Une hygiène à ne pas oublier

La clé JSON du compte de service et le jeton GitHub sont passés **en clair dans
une conversation**. Une fois tout stabilisé : régénérez-les (console Cloud pour
l'une, GitHub pour l'autre), donnez-moi les nouveaux, et le déploiement continue
sans rien casser.

## 2026-08-21 — deux choses qui ne peuvent PAS se faire d'ici

1. **Retirer la Coree du Sud du ciblage.** Mesure : la piste de test ferme cible
   **176 pays, Coree comprise**. L'API de publication ne sait pas la retirer —
   `countryAvailability` est en lecture seule et poser un ciblage sur une version
   `completed` est refuse (`Country targeting is only supported for staged
   releases`). **Chemin console** : Test → Test ferme → la piste → *Pays/regions*
   → decocher *Coree du Sud* → Enregistrer → envoyer a la revision.
   Details et traces dans `PLAY_DEPLOY.md`.

2. **Le questionnaire de classification du contenu doit declarer le jeu d'argent
   simule.** C'est ce qui a declenche l'avis du 2026-08-20, et l'API ne permet pas
   de lire la reponse donnee. A verifier **avant** toute promotion en production :
   si la reponse est « non », c'est plus grave que la Coree.
