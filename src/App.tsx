import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from 'react';
import { calculateSession, createStaffMember } from './domain/session';
import { DENOMS, type Denomination, type SessionState, type StaffMember, type TipAddition } from './domain/types';
import { billLabel, formatMoney } from './domain/money';
import { parsedKeepTargets, smallBillStatus } from './domain/smallBills';
import { formatClock, formatHours } from './domain/time';
import { clearSession, exportSession, importSessionFile, loadRosterNames, loadSession, saveSession } from './persistence/storage';

type Action =
  | { type: 'session/replace'; session: SessionState }
  | { type: 'session/setDate'; value: string }
  | { type: 'session/setCloseTime'; value: string }
  | { type: 'staff/add'; name?: string }
  | { type: 'staff/remove'; id: string }
  | { type: 'staff/update'; id: string; field: keyof StaffMember; value: string }
  | { type: 'cash/setMode'; value: SessionState['cash']['mode'] }
  | { type: 'cash/updateBill'; denom: Denomination; value: string }
  | { type: 'cash/setNetTotal'; value: string }
  | { type: 'cash/addIncrement' }
  | { type: 'cash/removeIncrement'; id: string }
  | { type: 'cash/updateIncrement'; id: string; field: keyof TipAddition; value: string };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'session/replace':
      return action.session;
    case 'session/setDate':
      return { ...state, date: action.value };
    case 'session/setCloseTime':
      return { ...state, closeTime: action.value };
    case 'staff/add':
      return { ...state, staff: [...state.staff, createStaffMember(action.name ?? '')] };
    case 'staff/remove':
      return { ...state, staff: state.staff.filter((person) => person.id !== action.id) };
    case 'staff/update':
      return {
        ...state,
        staff: state.staff.map((person) => (person.id === action.id ? { ...person, [action.field]: action.value } : person)),
      };
    case 'cash/setMode':
      return { ...state, cash: { ...state.cash, mode: action.value } };
    case 'cash/updateBill':
      return {
        ...state,
        cash: { ...state.cash, billCounts: { ...state.cash.billCounts, [action.denom]: cleanWholeInput(action.value) } },
      };
    case 'cash/setNetTotal':
      return { ...state, cash: { ...state.cash, netTotal: cleanWholeInput(action.value) } };
    case 'cash/addIncrement':
      return {
        ...state,
        cash: {
          ...state.cash,
          additions: [...state.cash.additions, { id: crypto.randomUUID(), amount: '', note: '' }],
        },
      };
    case 'cash/removeIncrement':
      return { ...state, cash: { ...state.cash, additions: state.cash.additions.filter((item) => item.id !== action.id) } };
    case 'cash/updateIncrement':
      return {
        ...state,
        cash: {
          ...state.cash,
          additions: state.cash.additions.map((item) => (
            item.id === action.id
              ? { ...item, [action.field]: action.field === 'amount' ? cleanWholeInput(action.value) : action.value }
              : item
          )),
        },
      };
    default:
      return state;
  }
}

export function App() {
  const [session, dispatch] = useReducer(reducer, undefined, loadSession);
  const [rosterNames, setRosterNames] = useState<string[]>(() => loadRosterNames());
  const [staffOpen, setStaffOpen] = useState(true);
  const [cashOpen, setCashOpen] = useState(true);
  const [billChartOpen, setBillChartOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const result = useMemo(() => calculateSession(session), [session]);

  useEffect(() => {
    saveSession(session);
    setRosterNames(loadRosterNames());
  }, [session]);

  const statusLabel = result.status === 'ready'
    ? 'Ready'
    : result.status === 'blocked'
      ? 'Blocked'
      : result.status === 'estimate'
        ? 'Estimate'
        : 'Needs info';

  function resetSession() {
    dispatch({ type: 'session/replace', session: clearSession() });
    setStaffOpen(true);
    setCashOpen(true);
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    importSessionFile(file)
      .then((next) => dispatch({ type: 'session/replace', session: next }))
      .catch((error: unknown) => window.alert(error instanceof Error ? error.message : 'Import failed.'));
    event.target.value = '';
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="eyebrow">Night shift</div>
          <h1>Tip Pool</h1>
        </div>
        <div className="header-actions">
          <input
            aria-label="Session date"
            className="date-input"
            type="date"
            value={session.date}
            onChange={(event) => dispatch({ type: 'session/setDate', value: event.target.value })}
          />
          <button className="ghost-btn" onClick={() => exportSession(session)}>Export</button>
          <button className="ghost-btn" onClick={() => importInputRef.current?.click()}>Import</button>
          <button className="danger-btn" onClick={resetSession}>New</button>
          <input ref={importInputRef} type="file" accept=".json,application/json" hidden onChange={importFile} />
        </div>
      </header>

      <section className={`status-card status-${result.status}`}>
        <div>
          <span className="status-pill">{statusLabel}</span>
          <p>{statusCopy(result.status)}</p>
        </div>
        <div className="status-total">{formatMoney(result.total)}</div>
      </section>

      {[...result.errors, ...result.warnings].map((message) => (
        <div key={message} className={result.errors.includes(message) ? 'alert alert-error' : 'alert alert-warn'}>{message}</div>
      ))}

      <Section
        title="Tonight's crew"
        summary={staffSummary(session, result.staff.length)}
        open={staffOpen}
        onToggle={() => setStaffOpen((open) => !open)}
      >
        <RosterChips names={rosterNames} staff={session.staff} onAdd={(name) => dispatch({ type: 'staff/add', name })} />
        <div className="close-time-row">
          <label>
            Close time
            <input
              value={session.closeTime}
              inputMode="decimal"
              placeholder="2.5"
              onChange={(event) => dispatch({ type: 'session/setCloseTime', value: event.target.value })}
            />
          </label>
          <span>Blank out times use this value and still display blank in the row.</span>
        </div>
        <div className="staff-list">
          {session.staff.map((person) => (
            <StaffRow key={person.id} person={person} closeTime={session.closeTime} dispatch={dispatch} />
          ))}
        </div>
        <button className="primary-btn full" onClick={() => dispatch({ type: 'staff/add' })}>+ Add person</button>
      </Section>

      <Section
        title="Cash"
        summary={`${formatMoney(result.total)} pool | ${session.cash.mode === 'billCounts' ? 'bill counts' : 'net total estimate'}`}
        open={cashOpen}
        onToggle={() => setCashOpen((open) => !open)}
      >
        <div className="mode-toggle">
          <button className={session.cash.mode === 'billCounts' ? 'active' : ''} onClick={() => dispatch({ type: 'cash/setMode', value: 'billCounts' })}>Bill counts</button>
          <button className={session.cash.mode === 'netTotal' ? 'active' : ''} onClick={() => dispatch({ type: 'cash/setMode', value: 'netTotal' })}>Net total</button>
        </div>

        {session.cash.mode === 'billCounts' ? (
          <div className="denom-list">
            {DENOMS.map((denom) => (
              <label key={denom} className="denom-row">
                <span>${denom}</span>
                <input
                  value={session.cash.billCounts[denom]}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  onChange={(event) => dispatch({ type: 'cash/updateBill', denom, value: event.target.value })}
                />
                <strong>{session.cash.billCounts[denom] ? formatMoney(Number(session.cash.billCounts[denom]) * denom) : '-'}</strong>
              </label>
            ))}
          </div>
        ) : (
          <div className="net-panel">
            <label>
              Set total
              <input
                value={session.cash.netTotal}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="0"
                onChange={(event) => dispatch({ type: 'cash/setNetTotal', value: event.target.value })}
              />
            </label>
            <div className="addition-list">
              {session.cash.additions.map((item) => (
                <div key={item.id} className="addition-row">
                  <input
                    aria-label="Added tip amount"
                    value={item.amount}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    placeholder="+ amount"
                    onChange={(event) => dispatch({ type: 'cash/updateIncrement', id: item.id, field: 'amount', value: event.target.value })}
                  />
                  <input
                    aria-label="Added tip note"
                    value={item.note}
                    placeholder="note"
                    onChange={(event) => dispatch({ type: 'cash/updateIncrement', id: item.id, field: 'note', value: event.target.value })}
                  />
                  <button className="icon-btn" onClick={() => dispatch({ type: 'cash/removeIncrement', id: item.id })}>x</button>
                </div>
              ))}
            </div>
            <button className="ghost-btn full" onClick={() => dispatch({ type: 'cash/addIncrement' })}>+ Add tip entry</button>
          </div>
        )}

        <SmallBillPanel result={result} />
      </Section>

      <Summary result={result} onOpenBillChart={() => setBillChartOpen(true)} />

      {billChartOpen ? <BillChartSheet result={result} onClose={() => setBillChartOpen(false)} /> : null}
    </div>
  );
}

function Section(props: { title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="section-card">
      <button className="section-header" onClick={props.onToggle}>
        <span>
          <strong>{props.title}</strong>
          <em>{props.summary}</em>
        </span>
        <b>{props.open ? 'Collapse' : 'Open'}</b>
      </button>
      {props.open ? <div className="section-body">{props.children}</div> : null}
    </section>
  );
}

function RosterChips(props: { names: string[]; staff: StaffMember[]; onAdd: (name: string) => void }) {
  const activeNames = new Set(props.staff.map((person) => person.name.trim()).filter(Boolean));
  const available = props.names.filter((name) => !activeNames.has(name));
  if (!available.length) return null;

  return (
    <div className="roster-chips" aria-label="Remembered names">
      {available.map((name) => (
        <button key={name} onClick={() => props.onAdd(name)}>{name}</button>
      ))}
    </div>
  );
}

function StaffRow(props: { person: StaffMember; closeTime: string; dispatch: React.Dispatch<Action> }) {
  const { person, closeTime, dispatch } = props;

  return (
    <div className="staff-row">
      <input
        aria-label="Staff name"
        value={person.name}
        placeholder="Name"
        onChange={(event) => dispatch({ type: 'staff/update', id: person.id, field: 'name', value: event.target.value })}
      />
      <input
        aria-label={`${person.name || 'Staff'} in time`}
        value={person.inTime}
        inputMode="decimal"
        placeholder="In"
        onChange={(event) => dispatch({ type: 'staff/update', id: person.id, field: 'inTime', value: event.target.value })}
      />
      <input
        aria-label={`${person.name || 'Staff'} out time`}
        value={person.outTime}
        inputMode="decimal"
        placeholder={closeTime || 'Out'}
        onChange={(event) => dispatch({ type: 'staff/update', id: person.id, field: 'outTime', value: event.target.value })}
      />
      <select
        aria-label="Closer override"
        value={person.closerOverride}
        onChange={(event) => dispatch({ type: 'staff/update', id: person.id, field: 'closerOverride', value: event.target.value })}
      >
        <option value="auto">Auto</option>
        <option value="closer">Closer</option>
        <option value="notCloser">Not closer</option>
      </select>
      <button className="icon-btn" onClick={() => dispatch({ type: 'staff/remove', id: person.id })}>x</button>
    </div>
  );
}

function SmallBillPanel(props: { result: ReturnType<typeof calculateSession> }) {
  const { result } = props;
  if (!result.requirements || !result.staff.length) {
    return <div className="small-bill-card muted-card">Add staff and cash to see small-bill guidance.</div>;
  }

  const requirements = result.requirements;
  const parsed = parsedKeepTargets(requirements);
  const status = smallBillStatus(requirements);

  return (
    <div className={`small-bill-card ${status === 'short' ? 'short' : 'covered'}`}>
      <div className="card-title">
        <span>Small bills to keep</span>
        <strong>{status === 'short' ? 'Need action' : 'Covered'}</strong>
      </div>
      <div className="keep-line">
        Keep: {parsed.ones} x $1, {parsed.fives} x $5, {parsed.tens} x $10
      </div>
      <div className="coverage-grid">
        <CoverageRow label="$1 value" need={requirements.minOnes} have={requirements.availableOnes} short={requirements.onesShort} />
        <CoverageRow label="$1+$5 value" need={requirements.minOneFiveValue} have={requirements.availableOneFiveValue} short={requirements.oneFiveShort} />
        <CoverageRow label="$1+$5+$10 value" need={requirements.minOneFiveTenValue} have={requirements.availableOneFiveTenValue} short={requirements.oneFiveTenShort} />
      </div>
      {requirements.fiftyCoverage > 0 ? (
        <p className="micro-copy">{requirements.fiftyCoverage} x $50 covering odd-ten needs lowers the visible $10 target.</p>
      ) : null}
    </div>
  );
}

function CoverageRow(props: { label: string; need: number; have: number; short: number }) {
  return (
    <div className={props.short ? 'coverage-row short' : 'coverage-row'}>
      <span>{props.label}</span>
      <b>need ${props.need}</b>
      <b>have ${props.have}</b>
      <strong>{props.short ? `short $${props.short}` : 'ok'}</strong>
    </div>
  );
}

function Summary(props: { result: ReturnType<typeof calculateSession>; onOpenBillChart: () => void }) {
  const { result } = props;

  return (
    <section className="summary-card">
      <div className="summary-hero">
        <div>
          <div className="eyebrow">Summary</div>
          <h2>{formatMoney(result.total)}</h2>
          <p>{result.staff.length ? `${formatHours(result.totalHours)} total hours | ${formatMoney(result.rate)}/hr` : 'Add crew and cash to start.'}</p>
        </div>
        <div className="metric-stack">
          <span>Paid {formatMoney(result.staff.reduce((sum, person) => sum + person.final, 0))}</span>
          <span>Chump {formatMoney(result.chump)}</span>
        </div>
      </div>

      <div className="person-list">
        {result.staff.map((person) => (
          <article key={person.id} className="person-card">
            <div className="avatar">{initials(person.name)}</div>
            <div className="person-main">
              <div>
                <strong>{person.name}</strong>
                {person.isCloser ? <span className="badge">Closer</span> : null}
              </div>
              <p>
                {formatClock(person.inValue, 'pm')} - {formatClock(person.outValue, person.outValue <= person.inValue ? 'am' : 'pm')}
                {person.outWasPlaceholder ? ' (close)' : ''} | {formatHours(person.hours)}h
              </p>
              {person.bills && result.distribution.ok ? <em>{billLabel(person.bills)}</em> : null}
            </div>
            <div className="payout">
              <strong>{formatMoney(person.final)}</strong>
              <span>{person.bonus ? `+${formatMoney(person.bonus)} bonus` : `${formatMoney(person.base)} base`}</span>
            </div>
          </article>
        ))}
      </div>

      {result.chump > 0 ? (
        <div className="chump-row">
          <span>Chump</span>
          <strong>{formatMoney(result.chump)}</strong>
        </div>
      ) : null}

      <button className="primary-btn full" disabled={!result.staff.length} onClick={props.onOpenBillChart}>View bill chart</button>
      {result.distribution.error ? <div className="alert alert-error compact">{result.distribution.error}</div> : null}
    </section>
  );
}

function BillChartSheet(props: { result: ReturnType<typeof calculateSession>; onClose: () => void }) {
  const { result } = props;

  return (
    <div className="sheet-backdrop" onClick={props.onClose}>
      <section className="sheet" onClick={(event) => event.stopPropagation()}>
        <button className="sheet-close" onClick={props.onClose}>Close</button>
        <div className="sheet-grabber" />
        <h2>Bill chart</h2>
        {!result.distribution.ok ? (
          <div className="alert alert-error">{result.distribution.error || 'Exact bill chart needs valid bill counts.'}</div>
        ) : (
          <div className="bill-chart">
            <div className="bill-chart-row head">
              <span>Name</span>
              {DENOMS.map((denom) => <span key={denom}>${denom}</span>)}
              <span>Total</span>
            </div>
            {result.distribution.slots.map((slot) => (
              <div key={slot.id} className={slot.isChump ? 'bill-chart-row chump' : 'bill-chart-row'}>
                <span>{slot.name}</span>
                {DENOMS.map((denom) => <span key={denom}>{slot.bills[denom] || '-'}</span>)}
                <strong>{formatMoney(slot.target)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function staffSummary(session: SessionState, computedStaffCount: number): string {
  const blankOuts = session.staff.filter((person) => person.name.trim() && !person.outTime.trim()).length;
  const typedOuts = session.staff.filter((person) => person.name.trim() && person.outTime.trim()).length;
  return `${computedStaffCount} staff | close ${session.closeTime || '-'} | ${typedOuts} typed outs | ${blankOuts} blank`;
}

function statusCopy(status: ReturnType<typeof calculateSession>['status']): string {
  switch (status) {
    case 'ready':
      return 'Exact payout and bill chart are available.';
    case 'blocked':
      return 'Payout math is available, but cash or bills need attention.';
    case 'estimate':
      return 'Net total mode is a planning estimate until exact bills are counted.';
    case 'needsInfo':
      return 'Enter staff, times, and cash in any order.';
  }
}

function initials(name: string): string {
  const text = name.trim();
  if (!text) return '?';
  return text.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function cleanWholeInput(value: string): string {
  return value.replace(/[^\d]/g, '');
}
