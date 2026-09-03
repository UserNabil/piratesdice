# Audit — pd/app/js/ui/dialogs.js (41 lignes)

Fichier lu EN ENTIER. Lot annonce **8 fonctions** ; **1 nommée** (`uiConfirm`) + arrows internes (close, onBack, onclick, rAF). Écart dû au compteur auto.

## (a) Fonctions

| nom | ligne |
|---|---|
| uiConfirm(msg, title, okLabel) (export) | 12 |
| (arrow) close(answer) | 27 |
| (arrow) onBack(ev) | 32 |
| (arrows) onclick data-yes/data-no/back | 34-36 |
| (arrow) rAF `classList.add('on')` | 39 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| uiConfirm | boîte de confirmation CSS (Promise<bool>) | **`innerHTML` interpole `title`/`msg`/`okLabel` sans échappement** (l.16-24) — voir finding | FAILLE |
| close | ferme, retire le listener `pd-back`, résout | nettoie `document.removeEventListener('pd-back', onBack)` ; `resolve` idempotent | OK |
| onBack | bouton retour Android ferme la question | `preventDefault` + close(false) | OK |
| onclick handlers | oui/non/fond | résolvent une fois | OK |

## (c) Findings

- **dialogs.js:16-24 | injection HTML latente (état incohérent / XSS) — `innerHTML` non échappé.**
  ```js
  back.innerHTML = `
    <div class="pd-ask-card pd-panel">
      <h3>${title}</h3>
      <p>${msg}</p>
      ...<button ... data-yes>${okLabel}</button>...`;
  ```
  `title`, `msg` et `okLabel` sont injectés dans le DOM sans échappement. **Aujourd'hui non exploitable** : l'unique appelant (boot.js:491) passe des chaînes i18n statiques (`t('set.eraseAsk')`, `t('set.erase')`, `t('set.eraseOk')`), sans donnée utilisateur. Mais le CONTRAT de la fonction est dangereux : le jour où un appelant y passe un contenu composé d'origine joueur/adverse (pseudo, message de salon), c'est une injection HTML/XSS directe dans la WebView. Correctif type : `textContent` pour `title`/`msg`/`okLabel`, ou échappement, en gardant le `<b>` volontaire si besoin. Gravité réelle actuelle : faible (aucun chemin hostile), mais défaut réel à corriger.
- Ressources (point 6) : listener `pd-back` retiré dans `close` ; `back.remove()` — pas de fuite.

**Verdict : FAILLES(1) [gravité max : injection latente / état incohérent]** — sûr avec l'appelant actuel, mais API non sûre par construction.
