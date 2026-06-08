import * as React from 'react';

export interface PersonCardProps {
  /** Employee name (rendered in Plex Sans) */
  name: string;
  /** Hours worked (number; "h" is appended) */
  hours: number | string;
  /** Clock-in time label, e.g. "5:00" */
  inTime?: string | null;
  /** Clock-out time label, e.g. "2:00" */
  outTime?: string | null;
  /** Total payout (number, shown with $) */
  payout: number | string;
  /** Base pay shown muted when there's no bonus */
  basePay?: number | string | null;
  /** Closer bonus — renders the green "+$xx" pill */
  bonus?: number | string | null;
  /** Marks the person as a closer (red badge) */
  isCloser?: boolean;
  onClick?: (() => void) | null;
  style?: React.CSSProperties;
}

/**
 * Summary-tab payout row: avatar, name, hours block, gold payout + bonus pill.
 * @startingPoint section="People" subtitle="Per-person payout row with hours & bonus" viewport="700x110"
 */
export function PersonCard(props: PersonCardProps): JSX.Element;
