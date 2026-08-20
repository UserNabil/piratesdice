/* ============================================================================
   ui/toast.js — la version mobile : un bandeau, en bas, au-dessus du pouce.
   ============================================================================ */

const LIFE = 2600;

function host() {
  let box = document.getElementById('pd-toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pd-toasts';
    document.body.appendChild(box);
  }
  return box;
}

export function toast(msg, type) {
  const note = document.createElement('div');
  note.className = 'pd-toast' + (type ? ' pd-toast-' + type : '');
  note.textContent = String(msg == null ? '' : msg);
  host().appendChild(note);
  requestAnimationFrame(() => note.classList.add('on'));
  setTimeout(() => {
    note.classList.remove('on');
    setTimeout(() => note.remove(), 260);
  }, LIFE);
  return note;
}
