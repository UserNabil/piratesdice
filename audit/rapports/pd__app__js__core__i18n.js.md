# Rapport — pd/app/js/core/i18n.js

Traduction cote application (4 langues : en/fr/es/ar), detection de langue, sens de lecture RTL, et `t()` avec substitution de variables. `initLang()` est appele au chargement du module (ligne 114).

**Comptage** : lot = 9. Je compte 7 fonctions nommees (`detect`, `t`, `lang`, `isRTL`, `stamp`, `setLang`, `initLang`) + 2 flechees (`.map((l)=>...)` ligne 76, `.replace(HOLE,(whole,name)=>...)` ligne 86) = 9. Concorde.

## a) Liste des fonctions
- detect | 72
- t | 82
- lang | 89
- isRTL | 91
- stamp | 94
- setLang | 100
- initLang | 108
- (flechee) map codes langue | 76
- (flechee) remplacement de trou `{name}` | 86

## b) Analyse par fonction
| nom | role | risques | statut |
|-----|------|---------|--------|
| detect | choisit la langue (localStorage puis navigator) | **`localStorage.getItem(KEY)` NON protege** alors que l'ecriture l'est dans setLang — voir Finding 1 | FAILLE |
| t | traduit une cle, substitue les vars | `TABLES[current]` toujours valide (current toujours valide) ; retombe sur BASE puis sur la cle ; **ne HTML-echappe PAS les vars substituees** (par conception — t ignore le contexte ; responsabilite de l'appelant, cf. boot.js Finding 1) | OK |
| lang | renvoie la langue courante | trivial | OK |
| isRTL | true si arabe | trivial | OK |
| stamp | pose `lang`/`dir` sur `<html>` | `document.documentElement` toujours present | OK |
| setLang | change la langue + persiste | valide `code` (`if (!TABLES[code]) return false`) ; **`localStorage.setItem` en try/catch** (« stockage refuse ») | OK |
| initLang | detecte + stampe, au chargement du module | appelle detect() (peut jeter, cf. Finding 1) puis stamp() | OK (herite du risque de detect) |

## c) Findings

### Finding 1 — lecture de localStorage non protegee → ecran noir au demarrage
`pd/app/js/core/i18n.js:73` (dans `detect`, appele par `initLang()` a `:109`, lui-meme execute au chargement du module a `:114`)
Gravite : **partie bloquee (echec de demarrage / ecran noir)**
```js
function detect() {
  const saved = (localStorage.getItem(KEY) || '').trim();   // <-- non protege
  ...
}
```
`setLang` protege deja l'ECRITURE :
```js
try { localStorage.setItem(KEY, code); } catch (_) { /* stockage refuse */ }
```
...mais la LECTURE dans `detect` ne l'est pas. Dans un contexte ou l'acces au stockage jette (WebView avec donnees de site desactivees, mode prive, `SecurityError` a l'acces de `localStorage`), `detect()` jette. Or `initLang()` est invoque au niveau module (ligne 114), et `boot.js` importe ce module en tete : l'exception remonte au chargement, **le module i18n echoue, et par cascade boot.js ne demarre pas** — ecran d'ouverture fige, sans message ni recours. L'asymetrie (ecriture gardee, lecture non) confirme l'oubli. Correctif attendu : envelopper la lecture dans un try/catch retombant sur `''`, comme pour l'ecriture.

Note (non bloquante) : `t()` ne HTML-echappe pas les valeurs substituees dans les trous `{name}`. Ce n'est pas une faille de `t()` en soi (elle ne connait pas le contexte de rendu), mais l'appelant doit echapper — ce que boot.js `settingsMarkup` omet (voir rapport boot.js, Finding 1).

## Statut : FAILLES(1) [gravite max : partie bloquee]
