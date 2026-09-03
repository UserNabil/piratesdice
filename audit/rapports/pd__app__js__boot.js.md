# Rapport — pd/app/js/boot.js

Demarrage de l'application mobile (Capacitor) : session Google, plein ecran, bouton RETOUR, modale de reglages, fermeture des portes vers le navigateur, boucle de reconnexion.

**Ecart de comptage** : le lot annonce 93 fonctions. Je compte **20 fonctions nommees** (`function`) + **53 fonctions flechees** (`=>`) = 73 unites appelables. La metrique auto (93) sur-compte (probablement `=>` + `function` + methodes inline). Ecart signale, non bloquant.

## a) Liste des fonctions nommees (nom | ligne)
- reglerBarreEtat | 41
- host | 53
- splashOff | 70
- wireArrierePlan | 87
- brancherLiens | 106
- wireBackButton | 127
- versionLisible | 166
- row | 173
- volRow | 186
- settingsMarkup | 206
- openSettings | 338
- demuter (imbriquee dans openSettings) | 417
- addHeaderButtons | 517
- fermerLesPortes | 556
- wireMotion | 612
- start | 623
- pretAAfficher | 676
- direEchec | 711
- relancer | 741
- essayer | 749

Fonctions flechees notables : `code` (110), `fire` (128), `dit` (232), `close`/`back` (348-349), `peindre`/`demuter`-callbacks (openSettings), `dedans` (557), `ouvrirDedans` (564), `polices`/`peint` (677), + callbacks d'evenements.

## b) Analyse par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| reglerBarreEtat | regle la barre d'etat Capacitor (bord a bord) | try/catch autour des appels plugin, rejet gere | OK |
| host | renvoie #dicewrap ou body | null-safe (`|| document.body`) | OK |
| splashOff | cache le splash natif | try/catch, rejet gere | OK |
| wireArrierePlan | coupe le son quand l'app passe en arriere-plan | callback plugin non protege : si `S.sfx.taire()` jette, exception dans le dispatch Capacitor (faible) ; listener jamais retire (mais duree = vie de l'app) | OK |
| brancherLiens | traite les liens d'invitation piratesdice:// | `code()` valide+assainit l'URL (try/catch, filtre `[A-Z0-9]`) ; `getLaunchUrl().then().catch()` gere le rejet | OK |
| wireBackButton | bouton RETOUR Android → accueil/pont/fermeture | selecteurs null-checkes ; `fire()` dispatch synchrone (un listener pd-back qui jette remonterait, faible) | OK |
| versionLisible | texte de version | assainit `build` via regex `[^0-9a-z.]` avant HTML — bonne hygiene | OK |
| row | ligne HTML label/body | interpole sans esc(), mais label = t() (dev) et body = HTML construit par l'appelant — donnees de confiance | OK |
| volRow | ligne de volume HTML | interpole canal/label/valeur (literaux + nombre), pas de donnee tierce | OK |
| settingsMarkup | HTML de la modale de reglages | **interpole le pseudo du joueur (`who`/`nomVif`) dans innerHTML SANS esc()** — voir Finding 1 | FAILLE |
| openSettings | monte/branche la modale de reglages | `oublier=surVolume()` desabonne dans close() (bonne gestion) ; pd-back en `{once:true}` ; **handler erase : `await eraseAccount()` sans try/catch apres fermeture** (Finding 2) ; signIn/out en try/catch | FAILLE |
| demuter | leve la coupure generale du son | null-check S.sfx | OK |
| addHeaderButtons | ajoute le bouton reglages | null-check + dedup par id | OK |
| fermerLesPortes | empeche toute sortie vers le navigateur externe | `dedans()`/`ouvrirDedans()` en try/catch ; override `window.open` en try/catch ; garde en phase capture — fonction positive pour la securite | OK |
| wireMotion | secouer = lancer le de | `canRoll` lit `S.state.dice[S.seat]` : si `S.state` present mais `dice` absent, TypeError dans le callback de secousse (faible) | OK |
| start | orchestre le demarrage | awaits dont les rejets remontent a essayer().catch (bon) ; **`brancherStudio().then()` sans `.catch`** (Finding 3) ; `setTimeout(lancerTutoriel)` non protege (faible) | OK |
| pretAAfficher | attend la 1re peinture | **`Promise.race` avec plafond 3 s** contre l'attente infinie de `fonts.ready` — excellent ; `fonts.ready.catch` gere | OK |
| direEchec | carte d'echec + compte a rebours | **n'affiche PAS `e.message`** (pas de fuite d'adresse serveur — bien) ; `setInterval` auto-nettoye quand `ligne` quitte le DOM ; bouton retry | OK |
| relancer | (re)programme une tentative | clear du timer precedent avant d'en poser un neuf ; `Math.max(0,dans)` | OK |
| essayer | lance start(), backoff exponentiel sur echec | `.catch` complet : splashOff+direEchec+relancer+backoff plafonne a 15 s ; reset sur `online`/`visibilitychange` — conception non bloquante robuste | OK |

## c) Findings

### Finding 1 — pseudo interpole dans innerHTML sans echappement HTML
`pd/app/js/boot.js:212-213` (definition) et `:261` (rendu `${who}`), monte via `openSettings` `wrap.innerHTML = settingsMarkup()` a `:341`
Gravite : **etat incoherent (XSS auto potentiel, faible)**
```js
const nomVif = (S.me && S.me.name) || acc.name;
const who = acc.google ? t('set.signedInAs', { name: nomVif }) : t('set.guest');
...
${row(t('set.account'), `<span class="pd-row-val">${who}</span>`)}
```
`t()` (i18n.js) substitue `{name}` par `String(nomVif)` **sans echapper** ; `who` est ensuite injecte en contenu HTML via `innerHTML`. Tout le reste du code de jeu (`www/js/pages/*.js`) passe systematiquement par `esc()` (ex. `<em>${esc(nom)}</em>`), **sauf ici**. Le champ pseudo voisin n'echappe que `"` (`String(nomVif).replace(/"/g,'&quot;')`), pas `<`/`&`.
Pourquoi c'est un risque : un nom contenant `<img onerror=...>` s'executerait au montage de la modale. Portee limitee (le nom affiche est celui du joueur LUI-MEME → XSS auto, non transmis a l'adversaire) et les pseudos sont valides cote serveur (2-10 caracteres, regles de caracteres) ; l'exposition depend donc de la permissivite du serveur et du nom Google. Correctif attendu : passer `nomVif`/`who` par `esc()` comme partout ailleurs.

### Finding 2 — eraseAccount() sans gestion de rejet, modale deja fermee
`pd/app/js/boot.js:489-495` (handler `[data-erase]` dans openSettings)
Gravite : **cosmetique / etat incoherent (faible)**
```js
wrap.querySelector('[data-erase]').onclick = async () => {
  close();
  if (!await uiConfirm(...)) return;
  await eraseAccount();
  toast(t('set.erased'), 'ok');
  setTimeout(() => location.reload(), 900);
};
```
Si `eraseAccount()` rejette (reseau, serveur), aucun `try/catch` : le handler async rejette (rejet non gere), le toast de confirmation et le reload ne se produisent pas, et la modale est deja fermee — le joueur ne recoit **aucun retour** et croit que rien ne s'est passe (ou que c'est fait). Un `catch` avec toast d'erreur manque.

### Finding 3 — brancherStudio().then() sans .catch
`pd/app/js/boot.js:663`
Gravite : **cosmetique (faible)**
```js
brancherStudio().then((la) => { if (la) console.log('[studio] atelier branche'); });
```
Le commentaire juste au-dessus indique que la recherche d'atelier « coute deux requetes qui echouent sur un vrai telephone ». Si `brancherStudio()` rejette (au lieu de resoudre `false`), c'est un rejet de promesse non gere. A confirmer selon l'implementation interne de `brancherStudio` (si elle avale ses propres erreurs, sans effet). Un `.catch(()=>{})` mettrait la chose hors de doute.

## Statut : FAILLES(3) [gravite max : etat incoherent]
