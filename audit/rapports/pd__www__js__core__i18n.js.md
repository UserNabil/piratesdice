# Audit — pd/www/js/core/i18n.js (114 lignes)

Fichier lu en entier. Lot annonce **9 fonctions**, **9 trouvées** (écart 0).

## (a) Fonctions

| nom | ligne |
|---|---|
| detect | 72 |
| (arrow) `.map((l) => ...)` | 76 |
| t | 82 |
| (arrow) `text.replace(HOLE, (whole, name) => ...)` | 86 |
| lang | 89 |
| isRTL | 91 |
| stamp | 94 |
| setLang | 100 |
| initLang | 108 |

## (b) Par fonction

| nom | rôle | risques | statut |
|---|---|---|---|
| detect | choisit la langue (localStorage puis navigateur, repli `en`) | **`localStorage.getItem` non protégé** (l.73) — voir finding | FAILLE |
| arrow l.76 | normalise chaque tag langue sur 2 lettres | `String(l)` protège contre non-string | OK |
| t | traduit une clé, repli anglais, substitue les `{var}` | **substitution non échappée** (l.86) — voir finding ; suppose valeur = string | FAILLE |
| arrow l.86 | remplace `{name}` par `String(vars[name])` | insère la valeur SANS échappement | FAILLE (voir #2) |
| lang | retourne la langue courante | — | OK |
| isRTL | vrai si langue RTL (`ar`) | — | OK |
| stamp | pose `lang`/`dir` sur `<html>` | `documentElement` toujours présent | OK |
| setLang | change de langue + persiste | valide `code` contre TABLES ; `setItem` en try/catch | OK |
| initLang | detect + stamp au chargement (appelée l.114) | propage l'exception de detect au chargement du module | dépend de #1 |

## (c) Findings

- **i18n.js:73 | partie bloquée (démarrage)** | `const saved = (localStorage.getItem(KEY) || '').trim();` dans `detect()`, hors try/catch | Dans un contexte où `localStorage` lève (Safari privé, stockage désactivé, WKWebView restreint), `detect()` lève. Or `initLang()` l'appelle au niveau module (l.114) : l'import de i18n.js échoue → toute l'app qui l'importe casse au démarrage. Incohérence flagrante : `setLang()` protège bien son `setItem` (l.103, commentaire « stockage refuse ») mais `detect()` ne protège pas son `getItem`. Gravité : partie bloquée.
- **i18n.js:86 | état incohérent (XSS latente)** | `text.replace(HOLE, (whole, name) => (vars[name] === undefined ? whole : String(vars[name])))` | La substitution insère `String(vars[name])` sans échappement. Des valeurs de traduction contiennent volontairement du HTML (`<b>` dans `rules.*`, cf. i18n_en.js:682) et sont rendues via `innerHTML`. Tout appelant faisant `el.innerHTML = t('clé', { x: donnéeContrôlée })` (ex. nom d'adversaire, trait de capitaine — cf. `'fx.foeTrait':'{name}: {trait}'`) injecte du HTML dans le DOM. C'est l'enabling weakness ; l'exploitation dépend d'un caller (dice_fx.js hors lot). Gravité : état incohérent / faille.
- **i18n.js:83 | cosmétique** | `TABLES[current][key] !== undefined ? ... : BASE[key]` puis `.replace` | `t()` suppose la valeur = chaîne ; une valeur non-string ferait lever `.replace`. Catalogues plats → improbable. Low.

**Verdict : FAILLES(2) [partie bloquée]**
