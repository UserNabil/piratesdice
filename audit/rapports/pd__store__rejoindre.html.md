# Rapport d'audit — `pd/store/rejoindre.html`

0 fonction — page HTML statique (page de rebond des invitations, déposée sur le
site GitHub Pages). Contient un petit script inline sans déclaration de fonction.

## Contenu
Lit `code` depuis `location.search`, le construit en lien `piratesdice://` et
tente un rebond après 350 ms tout en affichant toujours le bouton manuel.

## Risques
Aucun.
- Le code est **assaini avant tout usage** (ligne 110) :
  `.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)` — seuls 5 caractères
  alphanumériques survivent.
- Affichage via `textContent` (lignes 114, 117), jamais `innerHTML` → pas d'XSS.
- Le lien profond est construit avec `encodeURIComponent(code)` (ligne 111).
- Aucun secret, aucune commande, aucune injection. Les URL de boutique sont en
  clair et volontaires (App Store en recherche, faute d'identifiant connu —
  documenté lignes 96-101).
