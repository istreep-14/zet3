import * as React from 'react';

export type StaffInputRole = 'bartender' | 'server' | 'support';

export interface StaffInputRowProps {
  name?: string;
  inTime?: string;
  outTime?: string;
  hours?: number | string | null;
  role?: StaffInputRole;
  isCloser?: boolean;
  supportCuts?: string[];
  error?: boolean;
  onNameChange?: (value: string) => void;
  onInTimeChange?: (value: string) => void;
  onOutTimeChange?: (value: string) => void;
  onToggleCloser?: (() => void) | null;
  onDelete?: (() => void) | null;
  style?: React.CSSProperties;
}

/**
 * Compact staff entry row: name, in/out time wells, hours block, closer state,
 * support cut chips, and delete affordance.
 * @startingPoint section="People" subtitle="Staff name and shift-time input row" viewport="700x130"
 */
export function StaffInputRow(props: StaffInputRowProps): JSX.Element;
