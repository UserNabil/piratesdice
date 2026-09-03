# Rapport d'audit — pd/www/js/ui/dialogs.js

Chemin réel : `/Users/develop/piratesdice/www/js/ui/dialogs.js`
Lignes : 41. Lu en entier.

Rôle du fichier : une boîte de confirmation maison (CSS `.pd-panel`/`.dc-btn`)
qui remplace `confirm()` natif, cassé/invisible dans certaines WebViews Android.

## a) Liste de toutes les fonctions

| nom | ligne |
|-----|-------|
| uiConfirm(msg, title, okLabel) | 12 |
| close(answer) [arrow interne] | 27 |
| onBack(ev) [arrow interne] | 32 |

Écart de comptage : le lot annonce 8 fonctions ; je compte 3 fonctions nommées
(1 exportée + 2 arrows internes) + 5 callbacks fléchés anonymes (exécuteur de
`Promise`, `onclick` data-yes, `onclick` data-no, `back.onclick`,
`requestAnimationFrame`). Total ≈ 8. Métrique auto gonflée par les `=>`. Rien
manquant.

## b) Analyse par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| uiConfirm | Affiche un panneau de confirmation, résout `true`/`false`. | interpolation non échappée de `title`/`msg`/`okLabel` dans `innerHTML` — sink d'injection (Finding 1) | FAILLE |
| close | Retire le panneau, retire l'écouteur `pd-back`, résout la promesse. | nettoyage correct de l'élément et de l'écouteur (point 6 OK) | OK |
| onBack | Bouton Retour Android : ferme la question sans quitter le jeu. | `preventDefault` + `close(false)` | OK |

## c) Findings détaillés

### Finding 1 — Interpolation non échappée dans `innerHTML` (sink d'injection HTML/XSS latent)
- Emplacement : `dialogs.js:16-24`.
- Gravité : état incohérent (injection XSS) — **latente** : non atteignable par
  les appelants actuels.
- Extrait :
```js
back.innerHTML = `
  <div class="pd-ask-card pd-panel">
    <h3>${title}</h3>
    <p>${msg}</p>
    <div class="pd-ask-row">
      <button class="dc-btn dc-btn-ghost" data-no>${t('menu.cancel')}</button>
      <button class="dc-btn" data-yes>${okLabel}</button>
    </div>
  </div>`;
```
- Pourquoi c'est un risque : `title`, `msg` et `okLabel` sont insérés
  directement dans `innerHTML` sans échappement. Un argument contenant du HTML
  (ex. `<img src=x onerror=...>`) s'exécuterait dans la WebView. Grille point 4
  (« que fait un argument envoyé par un client hostile ? »).
- Exploitabilité aujourd'hui : **nulle**. Les trois seuls appelants
  (`boot.js:491`, `dice.js:838`, `dice_lobby.js:345` via son helper) passent
  exclusivement des chaînes i18n statiques via `t(...)` (`set.eraseAsk`,
  `game.leaveConfirm`, etc.), non contrôlées par un joueur. Le sink reste
  néanmoins réel : le premier futur appelant qui y injecterait une donnée
  dynamique (pseudo d'adversaire, code de table, nom de capitaine venu du
  serveur) transformerait ce panneau en exécution de script. À échapper
  (`textContent` ou échappement HTML) plutôt qu'à réserver à la vigilance des
  appelants.

## Statut fichier : FAILLES(1) [état incohérent / injection latente]
