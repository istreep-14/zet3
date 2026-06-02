// Pure helpers — no DOM side-effects; safe to unit-test in isolation

function parseWholeNumberString(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, empty: true, value: 0 };
  if (!/^\d+$/.test(text)) return { valid: false, empty: false, value: 0 };
  const value = Number(text);
  return {
    valid: Number.isSafeInteger(value),
    empty: false,
    value: Number.isSafeInteger(value) ? value : 0
  };
}

function parseTimeString(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { valid: true, empty: true, value: null };
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return { valid: false, empty: false, value: null };
  const value = Number(text);
  return {
    valid: Number.isFinite(value) && value >= 0 && value <= 12,
    empty: false,
    value: Number.isFinite(value) && value >= 0 && value <= 12 ? value : null
  };
}

function setInputInvalid(el, invalid) {
  if (el) el.classList.toggle('input-invalid', !!invalid);
}

function getVal(id) {
  const parsed = parseWholeNumberString($(id)?.value ?? '');
  return parsed.valid && parsed.value > 0 ? parsed.value : 0;
}

function poolValue(pool) {
  return DENOMS.reduce((s, d) => s + (pool[d] || 0) * d, 0);
}

function escapeHTML(v) {
  return String(v).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  )[c]);
}

function fmtHrs(h) {
  return parseFloat(h.toFixed(2)).toString();
}

function fmtTime(t, inTime, wrapped) {
  let hr = Math.floor(t), mn = Math.round((t - hr) * 60);
  if (mn === 60) { hr++; mn = 0; }
  let h12 = hr % 12;
  if (h12 === 0) h12 = 12;
  return h12 + (mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '') + (wrapped ? 'a' : 'p');
}

function fmtClock(t) {
  let hr = Math.floor(t), mn = Math.round((t - hr) * 60);
  if (mn === 60) { hr++; mn = 0; }
  let h12 = hr % 12;
  if (h12 === 0) h12 = 12;
  return h12 + ':' + (mn < 10 ? '0' : '') + mn;
}

function addClockMinutes(t, minutes) {
  const base = t % 12;
  let next = (base + minutes / 60) % 12;
  if (next < 0) next += 12;
  return next === 0 ? 12 : next;
}
