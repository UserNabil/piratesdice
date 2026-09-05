/* ============================================================================
   ui/dialogs.js — la version mobile.

   Le jeu ne demande qu'une chose : une confirmation avant d'abandonner une
   partie. On la rend en menuiserie CSS (.pd-panel / .dc-btn), pas en `confirm()`
   natif — dans une WebView, la boite du systeme casse la scene et, sur certaines
   surcouches Android, ne s'affiche pas du tout.
   ============================================================================ */

import { t } from '../core/i18n.js';
import { ouvrirContexte } from '../core/contexte.js';

export function uiConfirm(msg, title = 'Confirm', okLabel = 'OK') {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'pd-ask';
    back.innerHTML = `
      <div class="pd-ask-card pd-panel">
        <h3>${title}</h3>
        <p>${msg}</p>
        <div class="pd-ask-row">
          <button class="dc-btn dc-btn-ghost" data-no>${t('menu.cancel')}</button>
          <button class="dc-btn" data-yes>${okLabel}</button>
        </div>
      </div>`;
    (document.getElementById('dicewrap') || document.body).appendChild(back);

    /* La question vit dans la pile des contextes : le RETOUR repond « non » a
       LA question du dessus, jamais a autre chose. */
    let ctx = null;
    const close = (answer) => {
      if (ctx) { ctx.retirer(); ctx = null; }
      back.remove();
      resolve(answer);
    };
    ctx = ouvrirContexte('question', () => close(false));

    back.querySelector('[data-yes]').onclick = () => close(true);
    back.querySelector('[data-no]').onclick = () => close(false);
    back.onclick = (ev) => { if (ev.target === back) close(false); };
    requestAnimationFrame(() => back.classList.add('on'));
  });
}
