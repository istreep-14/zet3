// Small-bill requirement helpers.
// Keep cumulative value checks authoritative: extra $1s can satisfy some $5 needs,
// and $50s can reduce visible $10 needs for odd-tens payouts.

function getSmallBillRequirementsForAmounts(amounts, poolIn) {
  const pool = normalizePool(poolIn);
  const targets = (amounts || []).filter(v => Number.isFinite(v) && v > 0);
  const oddTenTargets = targets.filter(amount => Math.floor(amount / 10) % 2 !== 0);
  const fiftyEligibleOddTenCount = oddTenTargets.filter(amount => amount >= 50).length;
  const fiftyCoverage = Math.min(pool[50] || 0, fiftyEligibleOddTenCount);

  const minOnes = targets.reduce((sum, amount) => sum + (amount % 5), 0);
  const minOneFiveValue = targets.reduce((sum, amount) => sum + (amount % 10), 0);
  const minOneFiveTenRaw = targets.reduce((sum, amount) => sum + (amount % 20), 0);
  const minOneFiveTenValue = Math.max(minOneFiveValue, minOneFiveTenRaw - fiftyCoverage * 10);

  const availableOnes = pool[1] || 0;
  const availableOneFiveValue = availableOnes + (pool[5] || 0) * 5;
  const availableOneFiveTenValue = availableOneFiveValue + (pool[10] || 0) * 10;

  return {
    minOnes,
    availableOnes,
    onesShort: Math.max(0, minOnes - availableOnes),
    minOneFiveValue,
    availableOneFiveValue,
    oneFiveShort: Math.max(0, minOneFiveValue - availableOneFiveValue),
    minOneFiveTenValue,
    availableOneFiveTenValue,
    oneFiveTenShort: Math.max(0, minOneFiveTenValue - availableOneFiveTenValue),
    oddTenCount: oddTenTargets.length,
    fiftyEligibleOddTenCount,
    fiftyCoverage,
    fiftyCoverageValue: fiftyCoverage * 10
  };
}

function getSmallBillRequirementsForStaff(staffArr, poolIn, chumpAmount) {
  const amounts = (staffArr || []).map(p => p.final || p.orig || 0);
  if ((chumpAmount || 0) > 0) amounts.push(chumpAmount);
  return getSmallBillRequirementsForAmounts(amounts, poolIn);
}

function getSmallBillDisplayModel(req, poolIn) {
  const pool = normalizePool(poolIn);
  const oneFiveGap = Math.max(0, req.minOneFiveValue - req.minOnes);
  const oneFiveTenGap = Math.max(0, req.minOneFiveTenValue - req.minOneFiveValue);
  const parsed = {
    ones: req.minOnes,
    fives: Math.ceil(oneFiveGap / 5),
    tens: Math.ceil(oneFiveTenGap / 10)
  };
  const coverageRows = [
    {
      key: 'ones',
      label: '$1 value',
      need: req.minOnes,
      have: req.availableOnes,
      short: req.onesShort
    },
    {
      key: 'oneFive',
      label: '$1+$5 value',
      need: req.minOneFiveValue,
      have: req.availableOneFiveValue,
      short: req.oneFiveShort
    },
    {
      key: 'oneFiveTen',
      label: '$1+$5+$10 value',
      need: req.minOneFiveTenValue,
      have: req.availableOneFiveTenValue,
      short: req.oneFiveTenShort
    }
  ];

  return {
    status: coverageRows.some(row => row.short > 0) ? 'short' : 'covered',
    parsed,
    coverageRows,
    pool,
    fiftyCoverage: req.fiftyCoverage || 0
  };
}

function renderSmallBillRequirementSummary(req, pool, options = {}) {
  if (!req) return '';
  const model = getSmallBillDisplayModel(req, pool);
  const compact = !!options.compact;
  const title = options.title || 'Small bills to keep';
  const statusText = model.status === 'short' ? 'needs action' : 'covered';
  const coverageHTML = compact ? '' : model.coverageRows.map(row => {
    const cls = row.short > 0 ? 'req-row--short' : 'req-row--ok';
    const badge = row.short > 0
      ? `<span class="req-badge req-badge--short">short&nbsp;$${row.short}</span>`
      : '<span class="req-badge req-badge--ok">covered</span>';
    return `<div class="req-row ${cls}">
      <span class="req-row-lbl">${row.label}</span>
      <span class="req-row-need">$${row.need}&nbsp;need</span>
      <span class="req-row-have">$${row.have}&nbsp;have</span>
      ${badge}
    </div>`;
  }).join('');
  const fiftyNote = model.fiftyCoverage > 0
    ? `<div class="req-note">${model.fiftyCoverage}&nbsp;×&nbsp;$50 covering odd-ten needs.</div>`
    : '';

  return `<div class="req-summary req-summary--${model.status}${compact ? ' req-summary--compact' : ''}">
    <div class="req-summary-hdr"><span>${escapeHTML(title)}</span><em>${statusText}</em></div>
    <div class="req-keep-line">Keep: ${model.parsed.ones}&nbsp;×&nbsp;$1, ${model.parsed.fives}&nbsp;×&nbsp;$5, ${model.parsed.tens}&nbsp;×&nbsp;$10</div>
    ${coverageHTML}
    ${fiftyNote}
  </div>`;
}

function renderCashSmallBillStatus(staffArr, pool, chumpAmount, distributionError) {
  const el = $('cash-small-bills');
  if (!el) return;
  if (!staffArr || !staffArr.length || poolValue(pool || {}) <= 0) {
    el.innerHTML = '<div class="cash-small-bill-empty">Add named staff and cash to see small-bill guidance.</div>';
    return;
  }

  const req = getSmallBillRequirementsForStaff(staffArr, pool, chumpAmount || 0);
  const html = renderSmallBillRequirementSummary(req, pool, {
    compact: !distributionError && !req.onesShort && !req.oneFiveShort && !req.oneFiveTenShort,
    title: distributionError ? 'Small-bill blocker' : 'Small bills to keep'
  });
  el.innerHTML = html;
}
