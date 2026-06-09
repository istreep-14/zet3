import * as React from 'react';

export interface MoneyValueProps {
  /** Number (auto-formatted with $ and thousands) or a pre-formatted string */
  amount: number | string;
  /** Optional uppercase eyebrow above the figure */
  label?: string | null;
  /** Maps onto the type scale */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'hero';
  /** Use the brighter gold-2 (used for hours-adjacent emphasis) */
  bright?: boolean;
  style?: React.CSSProperties;
}

/**
 * Canonical dollar figure: mono, tabular, gold, optional eyebrow. Zero is muted.
 * @startingPoint section="Money" subtitle="Gold tabular money figure with eyebrow" viewport="700x120"
 */
export function MoneyValue(props: MoneyValueProps): JSX.Element;
