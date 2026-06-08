const _modalLastFocus = {};

function _openModalEls() {
  return [...document.querySelectorAll('.modal-overlay.open')];
}

function _syncModalBodyLock() {
  const hasOpenModal = _openModalEls().length > 0;
  document.body.classList.toggle('modal-open', hasOpenModal);
  document.body.style.overflow = hasOpenModal ? 'hidden' : '';
}

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  _modalLastFocus[id] = document.activeElement;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  _syncModalBodyLock();

  requestAnimationFrame(() => {
    if (!modal.classList.contains('open') || modal.contains(document.activeElement)) return;
    const focusTarget = modal.querySelector('.modal-close, button, input, [tabindex]:not([tabindex="-1"])');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  });
}

function closeModal(id) {
  const modal = $(id);
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  _syncModalBodyLock();

  const lastFocus = _modalLastFocus[id];
  if (lastFocus && document.body.contains(lastFocus)) {
    lastFocus.focus({ preventScroll: true });
  }
  delete _modalLastFocus[id];

  updateShiftStockCards();
  autoCalculate();
}

function modalBgClose(e, id) {
  if (e.target === $(id)) closeModal(id);
}

function closeTopModal() {
  const modals = _openModalEls();
  const topModal = modals[modals.length - 1];
  if (!topModal) return false;
  closeModal(topModal.id);
  return true;
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.setAttribute('aria-hidden', modal.classList.contains('open') ? 'false' : 'true');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (closeTopModal()) e.preventDefault();
});
