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

let playerPickerLayer = null;

/**
 * Elige jugador para una anotación.
 * @param {{ players: { id: string, name: string }[], title?: string }} opts
 * @returns {Promise<{ playerId: string | null, playerName: string | null } | false>}
 *          `false` = cancelado; si `players` está vacío, resuelve sin asignar.
 */
export function showPlayerPicker(opts) {
  const { players = [], title = '¿Quién anotó?' } = opts;

  return new Promise((resolve) => {
    if (!Array.isArray(players) || players.length === 0) {
      resolve({ playerId: null, playerName: null });
      return;
    }

    if (playerPickerLayer) {
      playerPickerLayer.remove();
      playerPickerLayer = null;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'player-picker-title');

    const card = document.createElement('div');
    card.className = 'modal-card modal-card--scroll';

    const accent = document.createElement('div');
    accent.className = 'modal-accent';
    accent.setAttribute('aria-hidden', 'true');

    const h = document.createElement('h2');
    h.id = 'player-picker-title';
    h.className = 'modal-title';
    h.textContent = title;

    const listWrap = document.createElement('div');
    listWrap.className = 'player-picker-list';

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      backdrop.classList.add('modal-backdrop--out');
      window.setTimeout(() => {
        backdrop.remove();
        if (playerPickerLayer === backdrop) playerPickerLayer = null;
        document.body.style.overflow = '';
        resolve(value);
      }, 180);
    };

    function onKey(e) {
      if (e.key === 'Escape') finish(false);
    }

    for (const p of players) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn btn-block player-picker-name';
      b.textContent = p.name || '—';
      b.addEventListener('click', () => finish({ playerId: p.id, playerName: p.name }));
      listWrap.appendChild(b);
    }

    const btnUnassigned = document.createElement('button');
    btnUnassigned.type = 'button';
    btnUnassigned.className = 'btn btn-block btn-modal-secondary';
    btnUnassigned.textContent = 'Sin asignar';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'btn btn-block btn-ghost';
    btnCancel.textContent = 'Cancelar';

    btnUnassigned.addEventListener('click', () => finish({ playerId: null, playerName: null }));
    btnCancel.addEventListener('click', () => finish(false));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false);
    });

    document.addEventListener('keydown', onKey);

    card.appendChild(accent);
    card.appendChild(h);
    card.appendChild(listWrap);
    card.appendChild(btnUnassigned);
    card.appendChild(btnCancel);
    backdrop.appendChild(card);

    document.body.style.overflow = 'hidden';
    document.body.appendChild(backdrop);
    playerPickerLayer = backdrop;
    requestAnimationFrame(() => backdrop.classList.add('modal-backdrop--in'));
    btnUnassigned.focus();
  });
}

let pwaUpdateBannerEl = null;

/** Barra fija cuando hay una nueva versión de la PWA lista para aplicar. */
export function showPwaUpdateBanner(applyUpdate) {
  if (typeof applyUpdate !== 'function') return;
  if (pwaUpdateBannerEl && document.body.contains(pwaUpdateBannerEl)) return;

  const bar = document.createElement('div');
  bar.className = 'pwa-update-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `
    <span class="pwa-update-banner-text">Nueva versión de GameScore disponible.</span>
    <button type="button" class="btn btn-primary btn-sm pwa-update-banner-apply">Actualizar</button>
    <button type="button" class="pwa-update-banner-dismiss" aria-label="Más tarde">×</button>
  `;

  const remove = () => {
    if (pwaUpdateBannerEl && pwaUpdateBannerEl.parentNode) {
      pwaUpdateBannerEl.remove();
    }
    pwaUpdateBannerEl = null;
  };

  bar.querySelector('.pwa-update-banner-apply').addEventListener('click', async () => {
    try {
      await applyUpdate();
    } catch {
      window.location.reload();
    }
  });

  bar.querySelector('.pwa-update-banner-dismiss').addEventListener('click', remove);

  document.body.appendChild(bar);
  pwaUpdateBannerEl = bar;
}
