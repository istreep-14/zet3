/**
 * TipPool — Google Sheet builder (Apps Script)
 *
 * Builds a fully formatted + validated spreadsheet that mirrors the web app's
 * pipeline: Staff times → hours → shares/closers → Cash entry → Distribution.
 *
 * SETUP (either way works):
 *  A) Bound:  open any Google Sheet → Extensions → Apps Script → paste this
 *     file → Run ▸ buildTipPoolSheet → authorize. Reload the sheet and a
 *     "TipPool" menu appears with a Rebuild item.
 *  B) Standalone: script.google.com → New project → paste → Run
 *     buildTipPoolSheet. The new spreadsheet URL is printed in the log.
 *
 * TIME MODEL (same as the app):
 *  - Times are decimal 12-hour readings: 5 = 5:00, 10.5 = 10:30, .25 = :15.
 *  - IN times: 9:00–11:59 → AM; everything else → PM (12 = noon).
 *  - OUT times: the next occurrence of that reading AFTER that person's IN
 *    (5p in, 2 out → 2a next day). Hours can never go negative.
 *  - Blank Out inherits the close time (= global Out resolved after the open).
 *  - Closers: override checkbox OR latest out among tipped staff (ties share).
 *  - Split: rate = total / Σhours; base = floor(share); remainder → closers
 *    (or manual bonuses); leftover = chump.
 *
 * NOTES / LIMITS vs the app:
 *  - A time of exactly 0 is treated as blank by the default-lookup formulas.
 *  - DISTRIBUTE() is a greedy largest-bill-first split (the app's engine does
 *    proportional + balanced sweeps + DFS fallback). Short payouts are flagged.
 *  - IDEALBILLS() (Net Total mode) breaks each payout into 20/10/5/1 greedily.
 */

const TP = {
  BG: '#0a0a0f', SURFACE: '#14141b', SURFACE2: '#1c1c26', BORDER: '#2a2a35',
  TEXT: '#e8e8ee', MUTED: '#8a8a99', ACCENT: '#e94560', GOLD: '#f5c842',
  GREEN: '#2ecc71', BLUE: '#4a9eff', MONO: 'Roboto Mono',
};
const TP_ROW0 = 13;            // first staff data row
const TP_NROWS = 20;           // staff capacity
const TP_LAST = TP_ROW0 + TP_NROWS - 1;   // 32
const TP_MAXPOOLS = 4;         // pool capacity (rows on Pools, $ cols on Summary)
const TP_POOL0 = 6;            // first pool data row on the Pools sheet

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('TipPool')
      .addItem('Rebuild sheet', 'buildTipPoolSheet')
      .addToUi();
  } catch (e) { /* no UI context */ }
}

function buildTipPoolSheet() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.create('TipPool');

  const tmp = ss.insertSheet('__tmp__');
  ['Staff', 'Pools', 'Cash', 'Summary', 'Dist', 'Sheet1'].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh) ss.deleteSheet(sh);
  });

  buildStaff_(ss);
  buildPools_(ss);
  buildSummary_(ss);
  buildDist_(ss);

  ss.deleteSheet(tmp);
  ss.setActiveSheet(ss.getSheetByName('Staff'));
  Logger.log('TipPool sheet ready: ' + ss.getUrl());
}

// ── shared helpers ────────────────────────────────────────────────────────────

function baseSheet_(ss, name, tabColor) {
  const sh = ss.insertSheet(name);
  sh.setTabColor(tabColor);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setBackground(TP.BG).setFontColor(TP.TEXT)
    .setFontFamily(TP.MONO).setFontSize(10);
  return sh;
}

function title_(sh, text, note) {
  sh.getRange('A1').setValue(text)
    .setFontColor(TP.GOLD).setFontSize(13).setFontWeight('bold');
  if (note) sh.getRange('A2').setValue(note).setFontColor(TP.MUTED).setFontSize(8);
}

function head_(range) {
  range.setBackground(TP.SURFACE2).setFontColor(TP.MUTED)
    .setFontSize(8).setFontWeight('bold');
}

function entry_(range) {
  range.setBackground(TP.SURFACE)
    .setBorder(true, true, true, true, true, true, TP.BORDER, SpreadsheetApp.BorderStyle.SOLID);
}

// "Format an absolute-axis time" (17 → 5p, 26 → 2a). Delegates to the FMTABS
// custom function below — a plain LET formula here tripped parse/coercion errors
// in some cells, and the JS version is the same code the app uses.
function fmtAbs_(ref) {
  return 'FMTABS(' + ref + ')';
}

// ── Staff sheet ───────────────────────────────────────────────────────────────

function buildStaff_(ss) {
  const sh = baseSheet_(ss, 'Staff', TP.ACCENT);
  title_(sh, 'TIPPOOL — STAFF & TIMES',
    'decimal times · 5 = 5:00 · 10.5 = 10:30 · IN 9–11:59 = am, else pm · OUT = next occurrence after that person\'s IN');

  // Defaults block
  sh.getRange('A4').setValue('DEFAULTS');
  head_(sh.getRange('A4:C4'));
  sh.getRange('B4').setValue('In');
  sh.getRange('C4').setValue('Out');
  sh.getRange('A5:A8').setValues([['global'], ['bartender'], ['server'], ['support']])
    .setFontColor(TP.MUTED);
  sh.getRange('B5').setValue(5);
  sh.getRange('C5').setValue(2);
  entry_(sh.getRange('B5:C8'));
  sh.getRange('B5:C8').setNumberFormat('0.##').setHorizontalAlignment('center');

  // Resolved session values
  sh.getRange('E4').setValue('SESSION');
  head_(sh.getRange('E4:G4'));
  sh.getRange('E5:E8').setValues([['open (anchor)'], ['close time'], ['peak out'], ['closers']])
    .setFontColor(TP.MUTED);
  sh.getRange('F5').setFormula(
    '=IF(ISNUMBER($B$5),IF($B$5>=9,$B$5,$B$5+12),IFERROR(MIN(FILTER($H$13:$H$32,$H$13:$H$32<>"")),17))');
  sh.getRange('F6').setFormula(
    '=IF(ISNUMBER($C$5),$C$5+12*MAX(0,INT(($F$5-$C$5)/12)+1),'
    + 'IFERROR(MAX(FILTER($N$13:$N$32,($D$13:$D$32<>"")*($N$13:$N$32<>""))),""))');
  sh.getRange('F7').setFormula(
    '=IFERROR(MAX(FILTER($I$13:$I$32,($B$13:$B$32<>"support")*($A$13:$A$32<>"")*($I$13:$I$32<>""))),"")');
  sh.getRange('F8').setFormula('=COUNTIF($K$13:$K$32,TRUE)');
  sh.getRange('G5').setFormula('=IF($F$5="","",' + fmtAbs_('$F$5') + ')');
  sh.getRange('G6').setFormula('=IF($F$6="","",' + fmtAbs_('$F$6') + ')');
  sh.getRange('F5:F8').setNumberFormat('0.0#').setFontColor(TP.MUTED);
  sh.getRange('G5:G6').setFontColor(TP.GOLD);

  // Staff table
  const headers = ['Name', 'Role', 'In', 'Out', 'Closer ✓', 'eff in', 'eff out',
    'in abs', 'out abs', 'Hours', 'Closer', 'Shift', 'Warning', 'expl out'];
  sh.getRange(12, 1, 1, headers.length).setValues([headers]);
  head_(sh.getRange(12, 1, 1, headers.length));

  const fF = [], fG = [], fH = [], fI = [], fJ = [], fK = [], fL = [], fM = [], fN = [];
  for (let i = TP_ROW0; i <= TP_LAST; i++) {
    fF.push(['=IF($A' + i + '="","",IF($C' + i + '<>"",$C' + i + ','
      + 'LET(rd,IFERROR(VLOOKUP($B' + i + ',$A$6:$C$8,2,FALSE),""),'
      + 'IF(OR(rd="",rd=0),IF($B$5<>"",$B$5,""),rd))))']);
    fG.push(['=IF($A' + i + '="","",IF($D' + i + '<>"",$D' + i + ','
      + 'LET(rd,IFERROR(VLOOKUP($B' + i + ',$A$6:$C$8,3,FALSE),""),'
      + 'IF(OR(rd="",rd=0),"",rd))))']);
    fH.push(['=IF(OR($A' + i + '="",$F' + i + '=""),"",IF($F' + i + '>=9,$F' + i + ',$F' + i + '+12))']);
    fN.push(['=IF(OR($A' + i + '="",$G' + i + '="",$H' + i + '=""),"",'
      + '$G' + i + '+12*MAX(0,INT(($H' + i + '-$G' + i + ')/12)+1))']);
    fI.push(['=IF($A' + i + '="","",IF($N' + i + '<>"",$N' + i + ',IF($F$6<>"",$F$6,"")))']);
    fJ.push(['=IF(OR($A' + i + '="",$H' + i + '="",$I' + i + '=""),"",$I' + i + '-$H' + i + ')']);
    fK.push(['=IF($A' + i + '="","",OR($E' + i + '=TRUE,'
      + 'AND($B' + i + '<>"support",$I' + i + '<>"",$F$7<>"",$I' + i + '>=$F$7-0.001)))']);
    fL.push(['=IF(OR($H' + i + '="",$I' + i + '=""),"",'
      + fmtAbs_('$H' + i) + '&"–"&' + fmtAbs_('$I' + i) + ')']);
    fM.push(['=IF($J' + i + '="","",IF($J' + i + '<=0,"⚠ invalid hours",IF($J' + i + '>12,"⚠ >12h","")))']);
  }
  sh.getRange(TP_ROW0, 6, TP_NROWS, 1).setFormulas(fF);
  sh.getRange(TP_ROW0, 7, TP_NROWS, 1).setFormulas(fG);
  sh.getRange(TP_ROW0, 8, TP_NROWS, 1).setFormulas(fH);
  sh.getRange(TP_ROW0, 9, TP_NROWS, 1).setFormulas(fI);
  sh.getRange(TP_ROW0, 10, TP_NROWS, 1).setFormulas(fJ);
  sh.getRange(TP_ROW0, 11, TP_NROWS, 1).setFormulas(fK);
  sh.getRange(TP_ROW0, 12, TP_NROWS, 1).setFormulas(fL);
  sh.getRange(TP_ROW0, 13, TP_NROWS, 1).setFormulas(fM);
  sh.getRange(TP_ROW0, 14, TP_NROWS, 1).setFormulas(fN);

  // Entry styling
  entry_(sh.getRange(TP_ROW0, 1, TP_NROWS, 5));
  sh.getRange(TP_ROW0, 3, TP_NROWS, 2).setNumberFormat('0.##').setHorizontalAlignment('center');
  sh.getRange(TP_ROW0, 5, TP_NROWS, 1).insertCheckboxes();
  // Helper / computed styling
  sh.getRange(TP_ROW0, 6, TP_NROWS, 4).setFontColor(TP.MUTED).setNumberFormat('0.0#').setHorizontalAlignment('center');
  sh.getRange(TP_ROW0, 14, TP_NROWS, 1).setFontColor(TP.MUTED).setNumberFormat('0.0#').setHorizontalAlignment('center');
  sh.getRange(TP_ROW0, 10, TP_NROWS, 1).setNumberFormat('0.0#"h"').setFontColor(TP.GOLD).setHorizontalAlignment('center');
  sh.getRange(TP_ROW0, 12, TP_NROWS, 1).setFontColor(TP.MUTED);
  sh.getRange(TP_ROW0, 13, TP_NROWS, 1).setFontColor(TP.ACCENT).setFontSize(8);

  // Validation
  const roleRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['bartender', 'server', 'support'], true).setAllowInvalid(false).build();
  sh.getRange(TP_ROW0, 2, TP_NROWS, 1).setDataValidation(roleRule);
  const timeRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=OR(C13="",AND(ISNUMBER(C13),C13>=0,C13<13))')
    .setAllowInvalid(false).setHelpText('Decimal time 0–12.99 (10.5 = 10:30)').build();
  sh.getRange('C13:D32').setDataValidation(timeRule);
  const defRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=OR(B5="",AND(ISNUMBER(B5),B5>=0,B5<13))')
    .setAllowInvalid(false).setHelpText('Decimal time 0–12.99').build();
  sh.getRange('B5:C8').setDataValidation(defRule);

  // Conditional formatting: invalid hours red, closers gold
  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($J13<>"",OR($J13<=0,$J13>12))')
      .setFontColor(TP.ACCENT)
      .setRanges([sh.getRange('J13:J32')]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$K13=TRUE')
      .setFontColor(TP.GOLD)
      .setRanges([sh.getRange('A13:A32'), sh.getRange('K13:K32')]).build(),
  ];
  sh.setConditionalFormatRules(rules);

  const widths = [140, 92, 52, 52, 62, 56, 56, 56, 56, 56, 56, 110, 120, 56];
  widths.forEach((w, c) => sh.setColumnWidth(c + 1, w));
  sh.setFrozenRows(12);
}

// ── Pools sheet (windows + roles + per-pool cash; replaces the single Cash) ────

function buildPools_(ss) {
  const sh = baseSheet_(ss, 'Pools', TP.GOLD);
  title_(sh, 'TIPPOOL — POOLS & CASH',
    'one row per pool: window (blank = open/close), which roles share it, and its cash (Net $ or per-bill). Support takes the tip-out % off the top of each pool it joins.');

  sh.getRange('A3').setValue('support tip-out %').setFontColor(TP.MUTED);
  sh.getRange('B3').setValue(0);
  entry_(sh.getRange('B3'));
  sh.getRange('B3').setNumberFormat('0"%"').setFontColor(TP.BLUE).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('B3').setDataValidation(SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=AND(ISNUMBER($B$3),$B$3>=0,$B$3<=100)')
    .setAllowInvalid(false).setHelpText('0–100 · % each pool gives support first').build());
  sh.getRange('C3').setValue('off the top of each pool · then split among support by hours; rest to bar/srv by hours')
    .setFontColor(TP.MUTED).setFontSize(8);

  const headers = ['Label', 'Start', 'End', 'Bar', 'Srv', 'Sup', 'Mode', 'Net $', '$100', '$50', '$20', '$10', '$5', '$1', 'Total'];
  const HR = TP_POOL0 - 1; // header row (5)
  sh.getRange(HR, 1, 1, headers.length).setValues([headers]);
  head_(sh.getRange(HR, 1, 1, headers.length));

  const r0 = TP_POOL0, n = TP_MAXPOOLS;
  sh.getRange(r0, 4, n, 3).insertCheckboxes();
  sh.getRange(r0, 1).setValue('Pool 1');
  sh.getRange(r0, 4, 1, 3).setValues([[true, true, false]]);
  sh.getRange(r0, 7, n, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Net', 'Bill'], true).setAllowInvalid(false).build());
  sh.getRange(r0, 7).setValue('Net');

  const totals = [];
  for (let i = 0; i < n; i++) {
    const rr = r0 + i;
    totals.push(['=IF($A' + rr + '="","",IF(REGEXMATCH($G' + rr + '&"","[Bb]ill"),'
      + 'SUMPRODUCT($I' + rr + ':$N' + rr + ',{100,50,20,10,5,1}),N($H' + rr + ')))']);
  }
  sh.getRange(r0, 15, n, 1).setFormulas(totals).setNumberFormat('"$"#,##0').setFontColor(TP.GOLD);

  entry_(sh.getRange(r0, 1, n, 14));
  sh.getRange(r0, 2, n, 2).setNumberFormat('0.##').setHorizontalAlignment('center');
  sh.getRange(r0, 8, n, 1).setNumberFormat('"$"#,##0').setHorizontalAlignment('center');
  sh.getRange(r0, 9, n, 6).setNumberFormat('0').setHorizontalAlignment('center');
  sh.getRange(r0, 2, n, 2).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=OR(B6="",AND(ISNUMBER(B6),B6>=0,B6<13))')
    .setAllowInvalid(false).setHelpText('blank = open/close · else decimal time 0–12.99').build());
  sh.getRange(r0, 8, n, 7).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=OR(H6="",AND(ISNUMBER(H6),H6>=0,MOD(H6,1)=0))')
    .setAllowInvalid(false).setHelpText('whole dollars / whole bill counts').build());

  const widths = [104, 46, 46, 34, 34, 34, 50, 64, 44, 44, 44, 44, 44, 44, 66];
  widths.forEach((w, c) => sh.setColumnWidth(c + 1, w));
  sh.setFrozenRows(HR);
}

// ── Summary sheet (multi-pool shares via custom functions) ────────────────────

function tpArgs_() {
  const POOLS = 'Pools!$A$' + TP_POOL0 + ':$N$' + (TP_POOL0 + TP_MAXPOOLS - 1);
  return 'Staff!$A$13:$E$32,Staff!$B$5:$C$8,' + POOLS + ',Pools!$B$3';
}

function buildSummary_(ss) {
  const sh = baseSheet_(ss, 'Summary', TP.GREEN);
  title_(sh, 'TIPPOOL — SUMMARY',
    'per-pool shares by overlap hours · support % off the top · remainder → closers · chump stays in the drawer');

  const ARGS = tpArgs_();

  // One TOTALS() call spilled off-screen (H3:M3 = cash, hours, rate, remainder, chump, closers).
  sh.getRange('H3').setFormula('=TOTALS(' + ARGS + ')');
  sh.getRange('H3:M3').setFontColor(TP.BG); // hide helper (blends into background)
  const hero = [['Total pool', '=$H$3'], ['Total hours', '=$I$3'], ['Rate', '=$J$3'],
    ['Remainder', '=$K$3'], ['Chump', '=$L$3'], ['Closers', '=$M$3']];
  sh.getRange(3, 1, hero.length, 1).setValues(hero.map(h => [h[0]])).setFontColor(TP.MUTED);
  sh.getRange(3, 2, hero.length, 1).setFormulas(hero.map(h => [h[1]]));
  sh.getRange('B3').setNumberFormat('"$"#,##0').setFontColor(TP.GOLD).setFontSize(12).setFontWeight('bold');
  sh.getRange('B4').setNumberFormat('0.0#"h"');
  sh.getRange('B5').setNumberFormat('"$"0.00"/hr"');
  sh.getRange('B6').setNumberFormat('"$"#,##0');
  sh.getRange('B7').setNumberFormat('"$"#,##0').setFontColor(TP.GOLD);
  sh.getRange('B8').setNumberFormat('0');

  // Pool meta: spilled header + one row per active pool (Pool, Start, End, Total, Hours, Rate, Sup tip).
  sh.getRange('A10').setValue('POOLS').setFontColor(TP.MUTED).setFontSize(8).setFontWeight('bold');
  sh.getRange('A11').setFormula('=POOL_META(' + ARGS + ')');
  head_(sh.getRange(11, 1, 1, 7));
  sh.getRange(12, 4, TP_MAXPOOLS, 1).setNumberFormat('"$"#,##0').setFontColor(TP.GOLD);
  sh.getRange(12, 7, TP_MAXPOOLS, 1).setNumberFormat('"$"#,##0').setFontColor(TP.MUTED);

  // Person × pool breakdown: spilled header at row 18, data 19+.
  const PR = 18;
  sh.getRange(PR - 1, 1).setValue('BREAKDOWN').setFontColor(TP.MUTED).setFontSize(8).setFontWeight('bold');
  sh.getRange(PR, 1).setFormula('=PERSON_SHARES(' + ARGS + ')');
  head_(sh.getRange(PR, 1, 1, 8 + TP_MAXPOOLS));
  sh.getRange(PR + 1, 5, TP_NROWS, TP_MAXPOOLS).setNumberFormat('"$"#,##0.00').setFontColor(TP.MUTED); // per-pool $
  const cE = 4 + TP_MAXPOOLS + 1;                              // Exact col
  sh.getRange(PR + 1, cE, TP_NROWS, 1).setNumberFormat('0.00').setFontColor(TP.MUTED);
  sh.getRange(PR + 1, cE + 1, TP_NROWS, 1).setNumberFormat('"$"#,##0');                    // Base
  sh.getRange(PR + 1, cE + 2, TP_NROWS, 1).setNumberFormat('"$"#,##0').setFontColor(TP.GREEN); // Bonus
  sh.getRange(PR + 1, cE + 3, TP_NROWS, 1).setNumberFormat('"$"#,##0').setFontColor(TP.GOLD).setFontWeight('bold'); // Final

  const widths = [130, 80, 30, 56, 60, 60, 60, 60, 64, 56, 56, 64];
  widths.forEach((w, c) => sh.setColumnWidth(c + 1, w));
  sh.setFrozenRows(2);
}

// ── Distribution sheet ────────────────────────────────────────────────────────

function buildDist_(ss) {
  const sh = baseSheet_(ss, 'Dist', TP.BLUE);
  title_(sh, 'TIPPOOL — BILL DISTRIBUTION',
    'balanced split ported from the app engine · drawer = merged per-bill pools, or ideal bills from the payouts when any pool is Net');

  const ARGS = tpArgs_();

  sh.getRange(4, 1).setValue('Drawer').setFontColor(TP.MUTED);
  sh.getRange(4, 2, 1, 6).setValues([['$100', '$50', '$20', '$10', '$5', '$1']]);
  head_(sh.getRange(4, 1, 1, 8));
  sh.getRange(4, 8).setValue('Value');
  sh.getRange('B5').setFormula('=DRAWER(' + ARGS + ')');
  sh.getRange('H5').setFormula('=SUMPRODUCT($B$5:$G$5,{100,50,20,10,5,1})')
    .setNumberFormat('"$"#,##0').setFontColor(TP.GOLD);
  sh.getRange('B5:G5').setHorizontalAlignment('center');

  sh.getRange('A8').setFormula(
    '=DISTRIBUTE(Summary!$A$19:$A$38,Summary!$L$19:$L$38,$B$5:$G$5,Summary!$B$7)');
  sh.getRange(8, 1, TP_NROWS + 6, 9).setFontSize(9);
  sh.getRange(9, 2, TP_NROWS + 5, 8).setHorizontalAlignment('center');

  const widths = [180, 56, 56, 56, 56, 56, 56, 70, 90];
  widths.forEach((w, c) => sh.setColumnWidth(c + 1, w));
}

// ── Custom functions (pure — recalculate automatically) ──────────────────────

/**
 * Format an absolute-axis time (hours past midnight on the open day) the way
 * the app does: 17 → "5p", 26 → "2a", 12 → "12p", 24 → "12a". Blank in, blank out.
 * @customfunction
 */
function FMTABS(t) {
  const n = Number(t);
  if (t === '' || t === null || t === undefined || !isFinite(n)) return '';
  let h = ((n % 24) + 24) % 24;
  let hr = Math.floor(h), mn = Math.round((h - hr) * 60);
  if (mn === 60) { hr = (hr + 1) % 24; mn = 0; }
  const am = hr < 12;
  let h12 = hr % 12; if (h12 === 0) h12 = 12;
  return h12 + (mn > 0 ? ':' + (mn < 10 ? '0' : '') + mn : '') + (am ? 'a' : 'p');
}

/**
 * Ideal drawer for a net-total pool: each payout target (plus the chump)
 * broken greedily into 20/10/5/1.
 * @customfunction
 * @return {Array} one row: [c100, c50, c20, c10, c5, c1]
 */
function IDEALBILLS(total, finals, chump) {
  const targets = [];
  (Array.isArray(finals) ? finals : [[finals]]).forEach(row => {
    const v = Number(row[0]);
    if (v > 0) targets.push(v);
  });
  if (Number(chump) > 0) targets.push(Number(chump));
  if (!targets.length && Number(total) > 0) targets.push(Number(total));

  const counts = { 20: 0, 10: 0, 5: 0, 1: 0 };
  targets.forEach(t => {
    let rem = Math.round(t);
    [20, 10, 5, 1].forEach(d => {
      const n = Math.floor(rem / d);
      counts[d] += n;
      rem -= n * d;
    });
  });
  return [[0, 0, counts[20], counts[10], counts[5], counts[1]]];
}

// ── Distribution engine — faithful port of src/engine.js (validated in Node
// against the app: same byPerson bills, remainder, and short/error messages).
// Pipeline: preflight → preferred path (proportional $100/$50, balanced sweep)
// → cascading sieve + DFS fallback → grade. Exact-or-fail (no partial payouts).
const DDEN = [100, 50, 20, 10, 5, 1];
function dblank() { return { 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 }; }
function dval(p) { return DDEN.reduce((s, d) => s + d * (p[d] || 0), 0); }
function dnorm(p) { const o = dblank(); DDEN.forEach(d => { o[d] = Math.max(0, Math.floor(Number(p && p[d]) || 0)); }); return o; }

function dSlots(people, leftover) {
  const slots = people.map(p => ({ id: p.id, orig: p.final, target: p.final, bills: dblank(), isRemainder: false }));
  if (leftover > 0) slots.push({ id: null, orig: leftover, target: leftover, bills: dblank(), isRemainder: true });
  return slots;
}
function dReq(slots, poolIn) {
  const pool = dnorm(poolIn);
  const targets = slots.map(s => s.orig);
  const oddTen = slots.filter(s => Math.floor(s.orig / 10) % 2 !== 0);
  const fiftyElig = oddTen.filter(s => s.orig >= 50).length;
  const fiftyCov = Math.min(pool[50] || 0, fiftyElig);
  const minOnes = targets.reduce((s, t) => s + (t % 5), 0);
  const minOF = targets.reduce((s, t) => s + (t % 10), 0);
  const minOFTraw = targets.reduce((s, t) => s + (t % 20), 0);
  const minOFT = Math.max(minOF, minOFTraw - fiftyCov * 10);
  const availOnes = pool[1] || 0;
  const availOF = availOnes + (pool[5] || 0) * 5;
  const availOFT = availOF + (pool[10] || 0) * 10;
  return {
    onesShort: Math.max(0, minOnes - availOnes),
    oneFiveShort: Math.max(0, minOF - availOF),
    oneFiveTenShort: Math.max(0, minOFT - availOFT),
  };
}
function dPreflight(slots, pool) {
  const need = slots.reduce((s, x) => s + x.target, 0);
  if (dval(pool) < need) return { ok: false, msg: 'Cash on hand is short $' + (need - dval(pool)) + '.' };
  const r = dReq(slots, pool);
  if (r.onesShort > 0) return { ok: false, msg: 'Need ' + r.onesShort + ' more $1s.' };
  if (r.oneFiveShort > 0) return { ok: false, msg: 'Need $' + r.oneFiveShort + ' more in $1s/$5s.' };
  if (r.oneFiveTenShort > 0) return { ok: false, msg: 'Need $' + r.oneFiveTenShort + ' more in $1s/$5s/$10s after $50s.' };
  return { ok: true };
}
function dSieve(slots, poolIn) {
  const p = dnorm(poolIn);
  slots.forEach(s => { const ones = s.target % 5; if (ones > 0) { s.bills[1] += ones; p[1] -= ones; s.target -= ones; } });
  let bOnes = Math.floor((p[1] || 0) / 5);
  slots.forEach(s => {
    if (s.target % 10 !== 5) return;
    if (bOnes > 0) { s.bills[1] += 5; p[1] -= 5; bOnes--; s.target -= 5; }
    else if ((p[5] || 0) > 0) { s.bills[5] += 1; p[5] -= 1; s.target -= 5; }
  });
  let bFives = Math.floor(((p[5] || 0) + bOnes) / 2);
  slots.forEach(s => {
    const odd = Math.floor(s.target / 10) % 2 !== 0;
    if (!odd || bFives <= 0) return;
    if ((p[5] || 0) >= 2) { s.bills[5] += 2; p[5] -= 2; s.target -= 10; bFives--; }
    else if ((p[5] || 0) === 1 && (p[1] || 0) >= 5) { s.bills[5] += 1; p[5] -= 1; s.bills[1] += 5; p[1] -= 5; s.target -= 10; bFives--; }
    else if ((p[1] || 0) >= 10) { s.bills[1] += 10; p[1] -= 10; s.target -= 10; bFives--; }
  });
  function small(s, value) {
    const maxF = Math.min(Math.floor(value / 5), p[5] || 0);
    for (let f = maxF; f >= 0; f--) { const ones = value - f * 5; if ((p[1] || 0) < ones) continue; s.bills[5] += f; p[5] -= f; s.bills[1] += ones; p[1] -= ones; s.target -= value; return true; }
    return false;
  }
  [20, 10].forEach(value => { let a = true; while (a) { a = false; const next = slots.filter(s => s.target >= value).sort((x, y) => x.target - y.target)[0]; if (next && small(next, value)) a = true; } });
  return p;
}
function dClone(slots) { return slots.map(s => ({ id: s.id, orig: s.orig, target: s.target, bills: { ...s.bills }, isRemainder: !!s.isRemainder })); }
function dApportion(slots, denom, available) {
  const caps = slots.map(s => Math.floor(s.target / denom));
  const count = Math.min(Math.max(0, available || 0), caps.reduce((s, c) => s + c, 0));
  const counts = slots.map(() => 0);
  if (count <= 0) return counts;
  const totalOrig = slots.reduce((s, x) => s + (x.orig || 0), 0) || 1;
  const shares = slots.map((s, i) => ({ i, raw: (s.orig || 0) / totalOrig * count }));
  let assigned = 0;
  for (const sh of shares) { counts[sh.i] = Math.min(caps[sh.i], Math.floor(sh.raw)); assigned += counts[sh.i]; }
  while (assigned < count) {
    const before = assigned;
    for (const next of shares.filter(sh => counts[sh.i] < caps[sh.i]).sort((a, b) => {
      const af = a.raw - Math.floor(a.raw), bf = b.raw - Math.floor(b.raw);
      return bf - af || (slots[b.i].orig || 0) - (slots[a.i].orig || 0) || (slots[b.i].target || 0) - (slots[a.i].target || 0) || a.i - b.i;
    })) { if (assigned >= count) break; counts[next.i]++; assigned++; }
    if (assigned === before) break;
  }
  return counts;
}
function dBest50(slots, pool) {
  const count = pool[50] || 0;
  if (count <= 0) return true;
  const caps = slots.map(s => Math.floor(s.target / 50));
  if (caps.reduce((s, c) => s + c, 0) < count) return false;
  const counts = slots.map(() => 0);
  let best = null;
  function lowOk(res) {
    if (res.reduce((s, r) => s + Math.floor(r / 20), 0) < (pool[20] || 0)) return false;
    if (res.reduce((s, r) => s + Math.floor(r / 10), 0) < (pool[10] || 0)) return false;
    if (res.reduce((s, r) => s + Math.floor(r / 5), 0) < (pool[5] || 0)) return false;
    return true;
  }
  function score() {
    const st = slots.filter(s => !s.isRemainder);
    const tot = st.reduce((s, x) => s + (x.orig || 0), 0) || 1;
    const hi = st.map(s => { const i = slots.indexOf(s); return (s.bills[100] || 0) * 100 + counts[i] * 50; });
    const totHi = hi.reduce((s, v) => s + v, 0);
    return st.reduce((s, x, i) => s + Math.abs(hi[i] - (x.orig || 0) / tot * totHi), 0);
  }
  function search(i, rem) {
    if (i === slots.length) { if (rem !== 0) return; const res = slots.map((s, idx) => s.target - counts[idx] * 50); if (!lowOk(res)) return; const sc = score(); if (!best || sc < best.score) best = { counts: [...counts], score: sc }; return; }
    const restCap = caps.slice(i + 1).reduce((s, c) => s + c, 0);
    const minU = Math.max(0, rem - restCap), maxU = Math.min(caps[i], rem);
    for (let u = minU; u <= maxU; u++) { counts[i] = u; search(i + 1, rem - u); } counts[i] = 0;
  }
  search(0, count);
  if (!best) return false;
  best.counts.forEach((n, i) => { slots[i].bills[50] += n; slots[i].target -= n * 50; });
  pool[50] = 0;
  return true;
}
function dDenom(slots, pool, denom) {
  const count = pool[denom] || 0;
  if (count <= 0) return true;
  const caps = slots.map(s => Math.floor(s.target / denom));
  if (caps.reduce((s, c) => s + c, 0) < count) return false;
  const counts = slots.map(() => 0);
  let best = null;
  function lowOk(res) {
    if (denom === 20 && res.reduce((s, r) => s + Math.floor(r / 10), 0) < (pool[10] || 0)) return false;
    if ((denom === 20 || denom === 10) && res.reduce((s, r) => s + Math.floor(r / 5), 0) < (pool[5] || 0)) return false;
    return true;
  }
  function score(res) {
    const sc = res.filter((_, i) => !slots[i].isRemainder);
    const avg = sc.reduce((s, r) => s + r, 0) / (sc.length || 1);
    const range = Math.max(...sc) - Math.min(...sc);
    const dev = sc.reduce((s, r) => s + Math.abs(r - avg), 0);
    const spread = Math.max(...counts) - Math.min(...counts);
    return range * 10000 + dev * 100 + spread;
  }
  function search(i, rem) {
    if (i === slots.length) { if (rem !== 0) return; const res = slots.map((s, idx) => s.target - counts[idx] * denom); if (!lowOk(res)) return; const sc = score(res); if (!best || sc < best.score) best = { counts: [...counts], score: sc }; return; }
    const restCap = caps.slice(i + 1).reduce((s, c) => s + c, 0);
    const minU = Math.max(0, rem - restCap), maxU = Math.min(caps[i], rem);
    for (let u = minU; u <= maxU; u++) { counts[i] = u; search(i + 1, rem - u); } counts[i] = 0;
  }
  search(0, count);
  if (!best) return false;
  best.counts.forEach((n, i) => { slots[i].bills[denom] += n; slots[i].target -= n * denom; });
  pool[denom] = 0;
  return true;
}
function dLower(slots, pool) {
  for (const d of [20, 10, 5]) if (!dDenom(slots, pool, d)) return false;
  const need = slots.reduce((s, x) => s + x.target, 0);
  if (need !== (pool[1] || 0)) return false;
  for (const s of slots) { if (s.target < 0) return false; s.bills[1] += s.target; pool[1] -= s.target; s.target = 0; }
  return slots.every(s => s.target === 0);
}
function dPreferred(slotsIn, poolIn) {
  const slots = dClone(slotsIn);
  const pool = dnorm(poolIn);
  function give(s, d, n) { const use = Math.min(n, pool[d] || 0, Math.floor(s.target / d)); if (use <= 0) return 0; s.bills[d] += use; pool[d] -= use; s.target -= use * d; return use; }
  dApportion(slots, 100, pool[100] || 0).forEach((c, i) => give(slots[i], 100, c));
  if (!dBest50(slots, pool)) return null;
  if (!dLower(slots, pool)) return null;
  return { slots, leftoverPool: pool };
}
function dDFS(slots, poolIn) {
  const paths = [];
  const big = [100, 50, 20, 10];
  const pool = dnorm(poolIn);
  const order = slots.map((_, i) => i).sort((a, b) => slots[b].target - slots[a].target);
  function search(pIdx) {
    if (paths.length >= 100) return;
    if (pIdx === slots.length) { paths.push({ slots: slots.map(s => ({ ...s, bills: { ...s.bills } })), leftoverPool: { ...pool } }); return; }
    const person = slots[order[pIdx]];
    if (person.target === 0) { search(pIdx + 1); return; }
    function fill(t, dIdx) {
      if (t === 0) { search(pIdx + 1); return; }
      if (dIdx >= big.length) return;
      const d = big[dIdx];
      const maxU = Math.min(pool[d] || 0, Math.floor(t / d));
      for (let u = maxU; u >= 0; u--) { person.bills[d] += u; pool[d] -= u; fill(t - u * d, dIdx + 1); person.bills[d] -= u; pool[d] += u; }
    }
    fill(person.target, 0);
  }
  search(0);
  return paths;
}
function dGrade(paths) {
  let best = null, low = Infinity;
  for (const path of paths) {
    let pen = 0; const tot = [], sml = [], med = [];
    for (const s of path.slots) {
      const idealBig = Math.floor(s.orig / 100);
      const actualBig = (s.bills[100] || 0) + ((s.bills[50] || 0) > 1 ? 1 : 0);
      pen += Math.abs(idealBig - actualBig) * 2;
      const c1 = s.bills[1] || 0, c5 = s.bills[5] || 0, c10 = s.bills[10] || 0, c20 = s.bills[20] || 0, c50 = s.bills[50] || 0, c100 = s.bills[100] || 0;
      tot.push(c1 + c5 + c10 + c20 + c50 + c100); sml.push(c1 + c5 + c10); med.push(c1 + c5 + c10 + c20);
    }
    pen += (Math.max(...tot) - Math.min(...tot)) * 10;
    pen += (Math.max(...sml) - Math.min(...sml)) * 8;
    pen += (Math.max(...med) - Math.min(...med)) * 5;
    if (pen < low) { low = pen; best = path; }
  }
  return best;
}
function dPipeline(people, poolIn, leftover) {
  const pool = dnorm(poolIn);
  const slots = dSlots(people, leftover || 0);
  const pre = dPreflight(slots, pool);
  if (!pre.ok) return { success: false, msg: pre.msg, poolAfter: pool, remainderBills: dblank(), byPerson: {} };
  const preferred = dPreferred(slots, pool);
  const sieve = preferred ? null : dSieve(slots, pool);
  const paths = preferred ? [preferred] : dDFS(slots, sieve);
  if (!paths.length) return { success: false, msg: 'Exact change impossible with current bills. Adjust bill counts in Cash.', poolAfter: sieve, remainderBills: dblank(), byPerson: {} };
  const best = preferred || dGrade(paths);
  const byPerson = {};
  best.slots.forEach(s => { if (s.isRemainder) return; byPerson[s.id] = { ...s.bills }; });
  const rem = best.slots.find(s => s.isRemainder);
  return { success: true, msg: '', poolAfter: best.leftoverPool, remainderBills: rem ? { ...rem.bills } : dblank(), byPerson };
}

/**
 * Bill distribution table for the drawer. Each person is paid EXACTLY their
 * total in balanced bills; the chump is one row that physically stays in the
 * drawer; an excess row appears only if the counted drawer exceeds payouts +
 * chump. If the drawer can't make exact change, one ⚠ message row explains why.
 * @customfunction
 * @return {Array} header + rows
 */
function DISTRIBUTE(names, payouts, drawer, chump) {
  const drawerRow = Array.isArray(drawer) ? drawer[0] : [drawer];
  const pool = {};
  DDEN.forEach((d, j) => { pool[d] = Math.max(0, Math.floor(Number(drawerRow[j]) || 0)); });

  const nameRows = Array.isArray(names) ? names : [[names]];
  const payRows = Array.isArray(payouts) ? payouts : [[payouts]];
  const people = [], labels = {};
  nameRows.forEach((row, i) => {
    const nm = String(row[0] || '').trim();
    const pay = Math.round(Number(payRows[i] ? payRows[i][0] : 0));
    if (nm && pay > 0) { const id = 'r' + i; people.push({ id: id, final: pay }); labels[id] = nm; }
  });

  const header = ['Name', '$100', '$50', '$20', '$10', '$5', '$1', 'Paid', 'Note'];
  if (!people.length) return [header, ['Enter staff & cash', '', '', '', '', '', '', '', '']];

  const res = dPipeline(people, pool, Math.round(Number(chump) || 0));
  if (!res.success) return [header, ['⚠ ' + res.msg, '', '', '', '', '', '', '', '']];

  const rowFor = (label, bills, note) => [label].concat(DDEN.map(d => bills[d] || 0)).concat([dval(bills), note]);
  const out = [header];
  people.forEach(p => out.push(rowFor(labels[p.id], res.byPerson[p.id] || dblank(), '')));
  if (Math.round(Number(chump) || 0) > 0) out.push(rowFor('Chump · stays in drawer', res.remainderBills, ''));
  if (dval(res.poolAfter) > 0) out.push(rowFor('⚠ Excess — drawer over-counted', res.poolAfter, 'recount Cash'));
  return out;
}

// ── Resolution + shares core (port of resolve.js + shares.js + support % off-top;
// validated in Node against the app — support-excluded cases match exactly).

function tp2d_(r) { return Array.isArray(r) ? r : [[r]]; }
function round2_(x) { return Math.round((Number(x) || 0) * 100) / 100; }
const TPEPS = 1e-9;

function tpResolveIn_(t) { if (t >= 9 && t < 12) return t; if (t >= 12) return t; return t + 12; }
function tpNextAfter_(t, a) { let v = t; while (v <= a) v += 12; return v; }
function tpAtOrAfter_(t, f) { let v = t; while (v < f) v += 12; return v; }
function tpParseTime_(raw) {
  if (raw === '' || raw === null || raw === undefined) return { empty: true, valid: true, value: null };
  const v = Number(raw);
  if (!isFinite(v) || v < 0 || v >= 13) return { empty: false, valid: false, value: null };
  return { empty: false, valid: true, value: v };
}
function tpOverlap_(inA, outA, s, e) { if (inA == null || outA == null) return 0; return Math.max(0, Math.min(outA, e) - Math.max(inA, s)); }
function tpStr_(v) { return String(v === '' || v == null ? '' : v).trim(); }

function tpDefaults_(d) {
  const a = tp2d_(d), g = a[0] || [], b = a[1] || [], s = a[2] || [], su = a[3] || [];
  return {
    global: { in: g[0], out: g[1] },
    byRole: { bartender: { in: b[0], out: b[1] }, server: { in: s[0], out: s[1] }, support: { in: su[0], out: su[1] } },
  };
}

function tpResolveStaff_(staffRows, defaults) {
  const named = staffRows.filter(r => tpStr_(r[0]));
  const gIn = tpParseTime_(defaults.global.in), gOut = tpParseTime_(defaults.global.out);

  const effIns = named.map(r => {
    const role = tpStr_(r[1]) || 'bartender';
    const rd = defaults.byRole[role] || {};
    return tpStr_(r[2]) || tpStr_(rd.in) || (gIn.empty ? '' : tpStr_(defaults.global.in));
  });

  let anchorAbs;
  if (gIn.valid && !gIn.empty) anchorAbs = tpResolveIn_(gIn.value);
  else {
    const ins = effIns.map(tpParseTime_).filter(p => p.valid && !p.empty).map(p => tpResolveIn_(p.value));
    anchorAbs = ins.length ? Math.min.apply(null, ins) : tpResolveIn_(5);
  }

  const partial = named.map((r, idx) => {
    const role = tpStr_(r[1]) || 'bartender';
    const rd = defaults.byRole[role] || {};
    const outRaw = tpStr_(r[3]) || tpStr_(rd.out);
    const ip = tpParseTime_(effIns[idx]);
    const inAbs = (ip.valid && !ip.empty) ? tpResolveIn_(ip.value) : null;
    let outAbs = null;
    if (outRaw) { const op = tpParseTime_(outRaw); if (op.valid && !op.empty) outAbs = inAbs != null ? tpNextAfter_(op.value, inAbs) : tpResolveIn_(op.value); }
    return { name: tpStr_(r[0]), role, closerOverride: r[4] === true || r[4] === 'TRUE', hasOut: !!outRaw, inAbs, outAbs };
  });

  let closeAbs = null;
  if (gOut.valid && !gOut.empty) closeAbs = tpNextAfter_(gOut.value, anchorAbs);
  else for (let i = 0; i < partial.length; i++) { const r = partial[i]; if (r.hasOut && r.outAbs != null && (closeAbs == null || r.outAbs > closeAbs)) closeAbs = r.outAbs; }

  const staff = partial.map(r => {
    let outAbs = r.outAbs;
    if (!r.hasOut && closeAbs != null) outAbs = closeAbs;
    const hours = (r.inAbs != null && outAbs != null) ? outAbs - r.inAbs : 0;
    return { name: r.name, role: r.role, inAbs: r.inAbs, outAbs, hours, closerOverride: r.closerOverride, closer: false };
  });

  const tipped = staff.filter(p => p.role !== 'support' && p.outAbs != null);
  const peak = tipped.length ? Math.max.apply(null, tipped.map(p => p.outAbs)) : null;
  staff.forEach(p => {
    const auto = p.role !== 'support' && peak != null && p.outAbs != null && p.outAbs >= peak - TPEPS;
    p.closer = p.closerOverride || auto;
  });
  return { staff, anchorAbs, closeAbs };
}

function tpResolvePools_(poolRows, resolved) {
  const { staff, anchorAbs, closeAbs } = resolved;
  const ins = staff.filter(p => p.inAbs != null).map(p => p.inAbs);
  const earliestIn = ins.length ? Math.min.apply(null, ins) : anchorAbs;
  return poolRows.filter(r => tpStr_(r[0])).map((r, i) => {
    let startAbs = earliestIn, endAbs = closeAbs != null ? closeAbs : earliestIn;
    const sp = tpParseTime_(r[1]); if (sp.valid && !sp.empty) startAbs = tpAtOrAfter_(sp.value, anchorAbs);
    const ep = tpParseTime_(r[2]); if (ep.valid && !ep.empty) endAbs = tpAtOrAfter_(ep.value, anchorAbs);
    const mode = /bill/i.test(tpStr_(r[6]) || 'Net') ? 'bill' : 'net';
    let total = 0, billCounts = null;
    if (mode === 'bill') { billCounts = {}; DDEN.forEach((d, j) => { billCounts[d] = Math.max(0, Math.floor(Number(r[8 + j]) || 0)); total += d * billCounts[d]; }); }
    else total = Math.max(0, Math.floor(Number(r[7]) || 0));
    return {
      id: 'p' + i, label: tpStr_(r[0]), startAbs, endAbs,
      roles: { bartender: r[3] === true || r[3] === 'TRUE', server: r[4] === true || r[4] === 'TRUE' },
      includeSupport: r[5] === true || r[5] === 'TRUE',
      entryMode: mode, billCounts, total,
    };
  });
}

// Per pool: support take pct% off the top (split among support by hours); the
// rest splits among bar/srv by hours. Then one global floor → remainder → closers.
function tpShares_(pools, staff, supportPct) {
  const pct = Math.max(0, Math.min(100, Number(supportPct) || 0)) / 100;
  const per = staff.map(p => ({ name: p.name, role: p.role, closer: p.closer, hours: 0, exact: 0, base: 0, bonus: 0, final: 0, perPool: {} }));
  const idx = new Map(); staff.forEach((s, i) => idx.set(s, per[i]));

  const perPool = pools.map(pool => {
    const parts = staff.map(s => ({ s, h: tpOverlap_(s.inAbs, s.outAbs, pool.startAbs, pool.endAbs) }))
      .filter(x => x.h > 0 && (pool.roles[x.s.role] || (x.s.role === 'support' && pool.includeSupport)));
    const sup = parts.filter(x => x.s.role === 'support');
    const supH = sup.reduce((s, x) => s + x.h, 0);
    const bsH = parts.filter(x => x.s.role !== 'support').reduce((s, x) => s + x.h, 0);
    const supTotal = (sup.length && pct > 0) ? pct * pool.total : 0;
    const supRate = supH > 0 ? supTotal / supH : 0;
    const bsRate = bsH > 0 ? (pool.total - supTotal) / bsH : 0;
    parts.forEach(({ s, h }) => {
      const raw = h * (s.role === 'support' ? supRate : bsRate);
      const pp = idx.get(s);
      pp.perPool[pool.id] = { hours: h, raw };
      pp.hours += h; pp.exact += raw;
    });
    return { id: pool.id, label: pool.label, startAbs: pool.startAbs, endAbs: pool.endAbs, total: pool.total, hours: supH + bsH, supTotal };
  });

  per.forEach(p => { p.base = Math.floor(p.exact); });
  const totalCash = pools.reduce((s, p) => s + p.total, 0);
  const totalHours = perPool.reduce((s, p) => s + p.hours, 0);
  const remainder = totalCash - per.reduce((s, p) => s + p.base, 0);
  const closers = per.filter(p => p.closer);
  const perCloser = closers.length ? Math.floor(remainder / closers.length) : 0;
  closers.forEach(p => { p.bonus = perCloser; });
  per.forEach(p => { p.final = p.base + p.bonus; });
  return {
    perPerson: per, perPool, totalCash, totalHours,
    rate: totalHours > 0 ? totalCash / totalHours : 0,
    remainder, leftover: remainder - perCloser * closers.length,
  };
}

function tpRun_(staff, defaults, pools, supportPct) {
  const res = tpResolveStaff_(tp2d_(staff), tpDefaults_(defaults));
  const pres = tpResolvePools_(tp2d_(pools), res);
  return { res, pres, shares: tpShares_(pres, res.staff, supportPct) };
}

/**
 * Session totals: [totalCash, totalHours, rate, remainder, chump, closers].
 * @customfunction
 */
function TOTALS(staff, defaults, pools, supportPct) {
  const { shares } = tpRun_(staff, defaults, pools, supportPct);
  return [[shares.totalCash, round2_(shares.totalHours), round2_(shares.rate), shares.remainder, shares.leftover,
    shares.perPerson.filter(p => p.closer).length]];
}

/**
 * Per-pool meta: header + one row per active pool (Pool, Start, End, Total, Hours, Rate, Sup tip).
 * @customfunction
 */
function POOL_META(staff, defaults, pools, supportPct) {
  const { pres, shares } = tpRun_(staff, defaults, pools, supportPct);
  const rows = [['Pool', 'Start', 'End', 'Total', 'Hours', 'Rate', 'Sup tip']];
  pres.forEach(p => {
    const m = shares.perPool.filter(x => x.id === p.id)[0] || { hours: 0, supTotal: 0 };
    rows.push([p.label, FMTABS(p.startAbs), FMTABS(p.endAbs), p.total, round2_(m.hours),
      m.hours > 0 ? round2_(p.total / m.hours) : 0, round2_(m.supTotal)]);
  });
  return rows;
}

/**
 * Per-person breakdown: Name, Role, Cl, Shift h, [$ per pool…], Exact, Base, Bonus, Final.
 * @customfunction
 */
function PERSON_SHARES(staff, defaults, pools, supportPct) {
  const { res, pres, shares } = tpRun_(staff, defaults, pools, supportPct);
  const labels = []; for (let k = 0; k < TP_MAXPOOLS; k++) labels.push(pres[k] ? pres[k].label : '·');
  const header = ['Name', 'Role', 'Cl', 'Shift h'].concat(labels).concat(['Exact', 'Base', 'Bonus', 'Final']);
  const rows = [header];
  shares.perPerson.forEach((p, i) => {
    const row = [p.name, p.role, p.closer ? 'C' : '', round2_(res.staff[i].hours)];
    for (let k = 0; k < TP_MAXPOOLS; k++) {
      const id = pres[k] ? pres[k].id : null;
      row.push(id && p.perPool[id] ? round2_(p.perPool[id].raw) : '');
    }
    row.push(round2_(p.exact), p.base, p.bonus, p.final);
    rows.push(row);
  });
  return rows;
}

/**
 * Drawer bills for distribution: merge per-bill pools when every pool is per-bill,
 * else ideal bills derived from the actual payouts (+chump). One row: [100,50,20,10,5,1].
 * @customfunction
 */
function DRAWER(staff, defaults, pools, supportPct) {
  const { pres, shares } = tpRun_(staff, defaults, pools, supportPct);
  if (pres.length && pres.every(p => p.entryMode === 'bill')) {
    const m = dblank();
    pres.forEach(p => { if (p.billCounts) DDEN.forEach(d => { m[d] += p.billCounts[d] || 0; }); });
    return [DDEN.map(d => m[d])];
  }
  return IDEALBILLS(shares.totalCash, shares.perPerson.map(p => [p.final]), shares.leftover);
}
