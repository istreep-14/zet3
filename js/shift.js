// Shift mode toggle — switches between Night and Day shift UI

function setShiftMode(mode, skipConfirm) {
  if (mode === shiftMode) return;

  // Warn if there's existing data
  if (!skipConfirm) {
    const hasNightData = shiftMode === 'night' && (getTotal() > 0 || lastStaff.length > 0);
    const hasDayData   = shiftMode === 'day'   && lastDayResult !== null;
    if (hasNightData || hasDayData) {
      if (!confirm('Switch shift mode? Current session data will be cleared.')) return;
    }
  }

  shiftMode = mode;

  // Toggle tab-panel visibility for cash section
  const nightCash = $('night-cash-section');
  const dayCash   = $('day-cash-section');
  if (nightCash) nightCash.style.display = mode === 'night' ? '' : 'none';
  if (dayCash)   dayCash.style.display   = mode === 'day'   ? '' : 'none';

  // Toggle staff sections
  const nightStaff = $('night-staff-section');
  const dayStaff   = $('day-staff-section');
  if (nightStaff) nightStaff.style.display = mode === 'night' ? '' : 'none';
  if (dayStaff)   dayStaff.style.display   = mode === 'day'   ? '' : 'none';

  // Update shift toggle buttons
  const btnNight = $('shift-btn-night');
  const btnDay   = $('shift-btn-day');
  if (btnNight) btnNight.classList.toggle('active', mode === 'night');
  if (btnDay)   btnDay.classList.toggle('active',   mode === 'day');

  // Update header subtitle
  const shiftLabel = $('shift-mode-label');
  if (shiftLabel) shiftLabel.textContent = mode === 'night' ? 'Night Shift' : 'Day Shift';

  // Reset results
  if (mode === 'night') {
    lastDayResult = null;
    lastStaff = [];
  } else {
    lastStaff = [];
    // Render day cash panels
    renderDayPoolCashPanels();
  }

  clearStaleBanners();
  renderBlockedPlaceholders(
    mode === 'night' ? 'Enter cash & staff to calculate.' : 'Enter day shift staff & pool cash to calculate.'
  );
  updateShiftStockCards();
  autoCalculate();
  saveState();
}

function updateShiftStockCards() {
  if (shiftMode === 'day') {
    updateDayStockCards();
  } else {
    updateStockCards();
  }
  updateTabIndicators();
}
