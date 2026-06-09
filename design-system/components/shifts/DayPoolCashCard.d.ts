import * as React from 'react';

export interface DayPoolCashCardProps {
  label: string;
  subtitle?: string | null;
  total?: number | string;
  isOpen?: boolean;
  optional?: boolean;
  windowStart?: string;
  windowEnd?: string;
  netTotal?: number | string;
  supportTipOut?: number | string | null;
  onToggle?: () => void;
  onWindowStartChange?: (value: string) => void;
  onWindowEndChange?: (value: string) => void;
  onNetTotalChange?: (value: string) => void;
  onRemove?: (() => void) | null;
  onSupportTipOut?: (() => void) | null;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Day-shift cash accordion: pool label/window, visible total, net input body,
 * optional party-window fields, and support tip-out action.
 * @startingPoint section="Shifts" subtitle="Day-pool cash entry accordion" viewport="700x180"
 */
export function DayPoolCashCard(props: DayPoolCashCardProps): JSX.Element;
