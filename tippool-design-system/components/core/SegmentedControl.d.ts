import * as React from 'react';

export interface SegmentOption {
  value: string;
  label: string;
}

export interface SegmentAccent {
  /** Active label color */
  color: string;
  /** Active border color */
  border: string;
}

export interface SegmentedControlProps {
  /** Options as plain strings or `{value,label}` objects */
  options: Array<string | SegmentOption>;
  /** Currently selected value */
  value: string;
  onChange?: (value: string) => void;
  /** Optional per-value active tint, e.g. `{ bartender: {color, border} }` */
  accentMap?: Record<string, SegmentAccent> | null;
  style?: React.CSSProperties;
}

/**
 * Uppercase mono segmented toggle — shift mode, staff role, cash-entry mode.
 * @startingPoint section="Core" subtitle="The signature toggle: shift / role / mode" viewport="700x110"
 */
export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
