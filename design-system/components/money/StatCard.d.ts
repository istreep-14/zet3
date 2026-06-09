import * as React from 'react';

export interface StatCardProps {
  /** Uppercase eyebrow, e.g. "Cash on Hand" */
  label: string;
  /** The headline value (string or number) */
  value: React.ReactNode;
  /** Optional small sub-line below the value */
  sub?: React.ReactNode;
  /** `money` colors the value gold; `neutral` uses primary text */
  tone?: 'money' | 'neutral';
  /** When provided, renders a navigation chevron and a pointer cursor */
  onClick?: (() => void) | null;
  style?: React.CSSProperties;
}

/**
 * Tappable home-dashboard metric tile with sheen, eyebrow, big value, sub-line.
 * @startingPoint section="Money" subtitle="Home metric tile: label, value, sub" viewport="700x140"
 */
export function StatCard(props: StatCardProps): JSX.Element;
