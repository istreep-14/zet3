import * as React from 'react';

export interface DenomRowProps {
  /** Denomination without the $, e.g. 100, 50, 20, 10, 5, 1 */
  denom: number;
  /** Current count value (controlled) */
  count?: number | string;
  /** Pre-formatted subtotal string, e.g. "$300", or null for "—" */
  subtotal?: string | null;
  onCountChange?: (value: string) => void;
  style?: React.CSSProperties;
}

/**
 * One bill-denomination input row: gold cap, centered count, subtotal cap.
 * @startingPoint section="Money" subtitle="Cash-counter denomination row" viewport="700x90"
 */
export function DenomRow(props: DenomRowProps): JSX.Element;
