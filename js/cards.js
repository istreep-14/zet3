function updateStockCards() {
  const total = getTotal();
  $('sc-total').textContent = '$' + total;
  const bc = DENOMS.map(d => ({ d, n: getVal('b' + d) })).filter(x => x.n > 0);
  $('sc-billcount').textContent = bc.length ? bc.reduce((s, x) => s + x.n, 0) + ' bills' : '—';
  const rows = document.querySelectorAll('#staffList .staff-row-modal, #nightServerList .staff-row-modal');
  let nc = 0;
  rows.forEach(r => { if (r.querySelector('[data-field="name"]').value.trim()) nc++; });
  $('sc-staffcount').textContent = nc;
  const spc = $('staffPageCount');
  if (spc) spc.textContent = nc + (nc === 1 ? ' person' : ' people');
}

// updateHomeLive — night shift home dashboard
//
// Parameters:
//   staffArr — computed staff array, or null when nothing is ready
//   metrics  — { rate, totH, leftover, distributionError }
//              Falls back to globals when not supplied, so existing callers
//              that pass only staffArr continue to work.

function updateHomeLive(staffArr, metrics) {
  const sec = $('home-live-section');
  if (!sec) return;

  // Resolve metrics — prefer explicit params, fall back to globals.
  const rate              = metrics?.rate              ?? lastRate              ?? 0;
  const totH              = metrics?.totH              ?? lastTotH              ?? 0;
  const leftover          = metrics?.leftover          ?? lastLeftover          ?? 0;
  const distributionError = metrics?.distributionError ?? lastDistributionError ?? '';

  const total = getTotal();
  const rows  = document.querySelectorAll('#staffList .staff-row-modal, #nightServerList .staff-row-modal');
  let named = 0;
  rows.forEach(r => { if (r.querySelector('[data-field="name"]').value.trim()) named++; });

  const ready    = total > 0 && !!staffArr && staffArr.length > 0;
  const distOk   = ready && !distributionError;
  const remainderText = ready && leftover > 0 ? '$' + leftover : '—';
  const rateText      = ready ? '$' + rate.toFixed(2) + '/hr' : '—';
  const paidText      = ready ? '$' + staffArr.reduce((s, p) => s + p.final, 0) : '—';

  const statusText = currentInputError || (!total ? 'Enter cash to start'
    : !named ? 'Add staff to calculate'
      : !ready ? 'Fix staff hours to calculate'
        : distOk ? 'Distribution ready'
          : 'Adjust bill counts in Cash');
  const statusClass = currentInputError ? 'warn' : distOk ? 'ok' : ready ? 'warn' : 'idle';

  sec.innerHTML = `
    <div class="home-dashboard">
      <div class="home-status-card ${statusClass}">
        <div class="home-status-label">Session status</div>
        <div class="home-status-title">${statusText}</div>
        <div class="home-status-sub">${ready ? named + ' staff · ' + fmtHrs(totH) + ' hrs' : 'Cash and staff drive the live payout preview'}</div>
      </div>
      <div class="home-metric-grid">
        <div class="home-metric"><span>Rate</span><strong>${rateText}</strong></div>
        <div class="home-metric"><span>Paid out</span><strong>${paidText}</strong></div>
        <div class="home-metric"><span>Chump</span><strong>${remainderText}</strong></div>
      </div>
      <div class="home-action-grid">
        <button onclick="switchTab('cash', $('tb-cash'))"><span>Cash</span><em>${total ? '$' + total : 'missing'}</em></button>
        <button onclick="switchTab('staff', $('tb-staff'))"><span>Staff</span><em>${named || 'missing'}</em></button>
        <button onclick="switchTab('summary', $('tb-summary'))"><span>Summary</span><em>${ready ? 'view payouts' : 'pending'}</em></button>
        <button onclick="switchTab('dist', $('tb-dist'))"><span>Chart</span><em>${distOk ? 'ready' : 'check bills'}</em></button>
      </div>
    </div>`;
}
