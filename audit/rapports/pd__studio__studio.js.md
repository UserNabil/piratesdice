# Audit — pd/studio/studio.js

Fichier : `/Users/develop/piratesdice/studio/studio.js` — 349 lignes.
Nature : JS client (navigateur) du panneau de réglage du studio. Parle au serveur local via `fetch`.
Fonctions annoncées : 49. Recomptées : **18 `function` + 3 const-flèche (`$`, `cle`, `dit`)** = 21 fonctions substantielles, plus ~16 gestionnaires d'événements fléchés inline (`oninput`/`onclick`/`onchange`/`addEventListener`). L'écart avec 49 vient de la métrique qui compte chaque `=>`. Signalé, pas bloquant.

## a) Liste des fonctions

| nom | ligne |
|-----|-------|
| $ (const flèche) | 11 |
| largeur | 19 |
| faceQuiGagne | 28 |
| face | 40 |
| nomDeFace | 43 |
| valeurDeFichier | 51 |
| valeurCourante | 55 |
| cle (const flèche) | 60 |
| racine | 64 |
| appliquer | 69 |
| morceaux | 87 |
| bornes | 93 |
| curseur | 101 |
| dit (const flèche, dans curseur) | 114 |
| commandes | 121 |
| dessiner | 171 |
| carte | 196 |
| etat | 274 |
| charger (async) | 283 |
| enregistrer (async) | 290 |
| cadrer | 326 |
| + gestionnaires inline | 115-116, 133-134, 152, 164, 213, 243, 265, 320-347 |

## b) Analyse fonction par fonction

| nom | rôle | risques | statut |
|-----|------|---------|--------|
| $ | querySelector raccourci | renvoie null si absent → NPE chez l'appelant (éléments fixes dans index.html) | OK |
| largeur | largeur choisie (parseInt de la valeur du select) | valeurs fixes du select | OK |
| faceQuiGagne | trouve la couche @media qui gagne à la taille du cadre | try/catch autour de `matchMedia` (cadre pas prêt) | OK |
| face | alias de faceQuiGagne | aucun | OK |
| nomDeFace | nom court d'une couche | aucun | OK |
| valeurDeFichier | valeur du fichier pour la face gagnante | `r.faces[...]` peut être `undefined` si face ∉ faces (fragile, voir F3) | OK (fragile) |
| valeurCourante | valeur modifiée sinon fichier | dépend de valeurDeFichier | OK (fragile) |
| cle | clé nom@face pour la Map modifies | aucun | OK |
| racine | #dicewrap dans l'iframe | garde `doc &&` ; renvoie null si iframe pas prêt | OK |
| appliquer | pose les styles inline dans le cadre | `if (!el) return` ; setProperty ignore silencieusement une valeur invalide | OK |
| morceaux | découpe une valeur multi-longueurs (2 à 4) | **`valeur.trim()` lève si valeur `undefined`** (voir F3) | OK (fragile) |
| bornes | min/max/pas d'un curseur | aucun | OK |
| curseur | construit un couple range+number | `valeur.match(LONGUEUR)` supposé non-null (garanti par l'appelant) | OK |
| commandes | choisit le type de commande selon la valeur | `commandes` lève si valeur `undefined` (`.length` ligne 161, `morceaux`) | OK (fragile) |
| dessiner | (re)construit le panneau groupé/filtré | si `carte(r)` lève, la boucle avorte → panneau à moitié dessiné | OK (dépend F3) |
| carte | construit la carte d'un réglage | handlers appellent appliquer/dessiner/etat ; pas de throw propre | OK |
| etat | met à jour la ligne d'état + bouton | aucun | OK |
| charger | GET /__studio/reglages, redessine | **pas de try/catch : rejet fetch/JSON non géré → init bloquée** (F1) | FAILLE |
| enregistrer | POST /__studio/enregistrer | **pas de try/catch : sur échec réseau, bouton reste `disabled`, état figé sur « ecriture… »** (F2) | FAILLE |
| cadrer | dimensionne/échelonne l'iframe | valeurs du select fixes ; `getBoundingClientRect` sûr | OK |
| handlers inline | branchements UI | voir enregistrer/charger pour les rejets async | OK |

## c) Findings détaillés

### F1 — charger(): aucune gestion d'erreur, l'init reste bloquée sur « chargement… »
`studio/studio.js:283-288` (et l'appel non gardé `studio/studio.js:349`)
```javascript
async function charger(garderModifs) {
  const rep = await fetch('/__studio/reglages');
  reglages = (await rep.json()).reglages;
  ...
}
...
charger(false);
```
Gravité : **outil bloqué**.
Aucun `try/catch` ni `.catch()`. Si le serveur est arrêté, répond en erreur, ou renvoie autre chose que du JSON (ex. la 500 non maquillée de `do_POST`/route absente), la promesse rejette : au démarrage (ligne 349) le rejet est non géré, `reglages` reste `[]`, le panneau ne se remplit jamais et la ligne d'état reste « chargement… » sans explication. `(await rep.json()).reglages` lèverait aussi si le corps n'est pas un objet. Un `try/catch` afficherait la panne dans `#etat`.

### F2 — enregistrer(): sur échec réseau, le bouton reste désactivé et l'état figé
`studio/studio.js:301-308`
```javascript
$('#enregistrer').disabled = true;
etat('ecriture…');
const rep = await fetch('/__studio/enregistrer', { method:'POST', ... });
const res = await rep.json();
if (!res.ok) return etat('ECHEC : ' + res.erreur);
```
Gravité : **outil bloqué**.
Le bouton est désactivé AVANT le `fetch` et n'est jamais réactivé en cas de rejet. Si le `fetch` échoue (serveur coupé) ou si `rep.json()` lève (réponse non-JSON), la promesse rejette, `#etat` reste « ecriture… » et « Enregistrer » demeure `disabled` : l'utilisateur croit une écriture en cours et doit recharger la page. Le cas `res.ok === false` est géré (ligne 308) mais laisse aussi le bouton désactivé (moins grave car un message s'affiche). Il manque un `try/catch/finally` qui réactive le bouton.

### F3 — valeurDeFichier / morceaux / commandes: pas de garde si la valeur est absente
`studio/studio.js:51-53`, `studio/studio.js:88`, `studio/studio.js:161`
```javascript
function valeurDeFichier(r) { return r.faces[face(r)]; }
...
const bouts = valeur.trim().split(/\s+/);   // morceaux
...
document.createElement(valeur.length > 46 ? 'textarea' : 'input');  // commandes
```
Gravité : **état incohérent (panneau à moitié dessiné) — conditionnel**.
Si `face(r)` renvoie une clé absente de `r.faces` (ou `r.faces` manquant), `valeurDeFichier` renvoie `undefined`. `morceaux(undefined)` lève sur `.trim()`, et `commandes` lève sur `.length` — ces exceptions remontent dans la boucle de `dessiner` (ligne 191) qui s'interrompt : les réglages suivants ne s'affichent plus, sans erreur visible à l'écran. En flux normal le serveur garantit que `face(r) ∈ r.faces` (via `ordre`/`faces`), donc le cas ne se produit pas aujourd'hui ; mais toute donnée serveur malformée casse le panneau silencieusement. Une garde (`if (valeur == null) return …`) fiabiliserait le rendu.

Note concurrence : JS mono-thread ; `enregistrer` désactive le bouton (anti double-clic), mais pendant son `await` un clic sur « Repartir du fichier » (ligne 322 → `charger`) peut s'entrelacer avec le `modifies.clear()`/`charger(false)` final de `enregistrer` — inoffensif pour un outil de dev.
