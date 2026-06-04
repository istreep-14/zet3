function openModal(id) {
  $(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(id).classList.remove('open');
  document.body.style.overflow = '';
  updateShiftStockCards();
  autoCalculate();
}

function modalBgClose(e, id) {
  if (e.target === $(id)) closeModal(id);
}
