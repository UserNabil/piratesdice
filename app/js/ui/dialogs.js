/* ============================================================================
   ui/dialogs.js — la version mobile.

   Le jeu ne demande qu'une chose : une confirmation avant d'abandonner une
   partie. On la rend en menuiserie CSS (.pd-panel / .dc-btn), pas en `confirm()`
   natif — dans une WebView, la boite du systeme casse la scene et, sur certaines
   surcouches Android, ne s'affiche pas du tout.
   ============================================================================ */

import { t } from '../core/i18n.js';

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

    const close = (answer) => {
      back.remove();
      document.removeEventListener('pd-back', onBack);
      resolve(answer);
    };
    const onBack = (ev) => { ev.preventDefault(); close(false); };

    back.querySelector('[data-yes]').onclick = () => close(true);
    back.querySelector('[data-no]').onclick = () => close(false);
    back.onclick = (ev) => { if (ev.target === back) close(false); };
    /* Le bouton RETOUR d'Android ferme la question, il ne quitte pas le jeu. */
    document.addEventListener('pd-back', onBack);
    requestAnimationFrame(() => back.classList.add('on'));
  });
}
