import { createDefaultSession } from '../domain/session';
import type { SessionState, StaffMember } from '../domain/types';

const SESSION_KEY = 'tippool_session_v2';
const ROSTER_KEY = 'tippool_roster_v1';

interface RosterState {
  version: 1;
  names: string[];
}

export function loadSession(): SessionState {
  if (typeof localStorage === 'undefined') return createDefaultSession();

  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return createDefaultSession();
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed.version !== 2 || !Array.isArray(parsed.staff) || !parsed.cash) return createDefaultSession();
    if (!parsed.cash.netKnownBills) {
      parsed.cash.netKnownBills = { 100: '', 50: '' };
    }
    return parsed;
  } catch {
    return createDefaultSession();
  }
}

export function saveSession(session: SessionState): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  rememberRosterNames(session.staff);
}

export function clearSession(): SessionState {
  localStorage.removeItem(SESSION_KEY);
  return createDefaultSession();
}

export function loadRosterNames(): string[] {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RosterState;
    return parsed.version === 1 && Array.isArray(parsed.names) ? parsed.names : [];
  } catch {
    return [];
  }
}

export function rememberRosterNames(staff: StaffMember[]): void {
  const existing = loadRosterNames();
  const next = new Set(existing);
  staff.forEach((person) => {
    const name = person.name.trim();
    if (name) next.add(name);
  });
  localStorage.setItem(ROSTER_KEY, JSON.stringify({ version: 1, names: [...next].sort() }));
}

export function exportSession(session: SessionState): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tippool-${session.date || 'session'}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function importSessionFile(file: File): Promise<SessionState> {
  return file.text().then((text) => {
    const parsed = JSON.parse(text) as SessionState;
    if (parsed.version !== 2 || !Array.isArray(parsed.staff) || !parsed.cash) {
      throw new Error('Imported file is not a TipPool v2 session.');
    }
    return parsed;
  });
}
