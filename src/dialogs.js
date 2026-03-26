let modalLayer = null;
let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-stack';
  toastContainer.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message, opts = {}) {
  const { variant = 'error', duration = 4200 } = opts;
  const stack = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast toast--${variant}`;
  el.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  if (variant === 'error') icon.textContent = '✕';
  else if (variant === 'success') icon.textContent = '✓';
  else icon.textContent = 'i';

  const text = document.createElement('p');
  text.className = 'toast-text';
  text.textContent = message;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast-close';
  close.setAttribute('aria-label', 'Cerrar');
  close.innerHTML = '&times;';

  el.appendChild(icon);
  el.appendChild(text);
  el.appendChild(close);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    el.classList.add('toast--out');
    window.setTimeout(() => {
      el.remove();
      if (stack.children.length === 0) {
        stack.remove();
        toastContainer = null;
      }
    }, 220);
  };

  let dismissTimer = null;
  close.addEventListener('click', () => {
    if (dismissTimer != null) window.clearTimeout(dismissTimer);
    remove();
  });
  dismissTimer = window.setTimeout(remove, duration);

  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--in'));
}

export function showConfirm(message, opts = {}) {
  const {
    title = 'Confirmar',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    danger = false
  } = opts;

  return new Promise((resolve) => {
    if (modalLayer) {
      modalLayer.remove();
      modalLayer = null;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'modal-title');

    const card = document.createElement('div');
    card.className = 'modal-card';

    const accent = document.createElement('div');
    accent.className = 'modal-accent';
    accent.setAttribute('aria-hidden', 'true');

    const h = document.createElement('h2');
    h.id = 'modal-title';
    h.className = 'modal-title';
    h.textContent = title;

    const p = document.createElement('p');
    p.className = 'modal-body';
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'btn btn-modal btn-modal-secondary';
    btnCancel.textContent = cancelText;

    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = danger ? 'btn btn-modal btn-modal-danger' : 'btn btn-modal btn-modal-primary';
    btnOk.textContent = confirmText;

    const finish = (value) => {
      document.removeEventListener('keydown', onKey);
      backdrop.classList.add('modal-backdrop--out');
      window.setTimeout(() => {
        backdrop.remove();
        if (modalLayer === backdrop) modalLayer = null;
        document.body.style.overflow = '';
        resolve(value);
      }, 180);
    };

    function onKey(e) {
      if (e.key === 'Escape') finish(false);
    }

    btnCancel.addEventListener('click', () => finish(false));
    btnOk.addEventListener('click', () => finish(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false);
    });

    document.addEventListener('keydown', onKey);

    actions.appendChild(btnCancel);
    actions.appendChild(btnOk);
    card.appendChild(accent);
    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(actions);
    backdrop.appendChild(card);

    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);
    modalLayer = backdrop;
    requestAnimationFrame(() => backdrop.classList.add('modal-backdrop--in'));
    btnOk.focus();
  });
}
