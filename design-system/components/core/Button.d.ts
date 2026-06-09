import * as React from 'react';

export interface ButtonProps {
  /** Button label */
  children: React.ReactNode;
  /** Visual style. `accent` is the primary red action; `gold` confirms/money. */
  variant?: 'accent' | 'gold' | 'secondary' | 'ghost' | 'danger' | 'dashed';
  /** Size of the control */
  size?: 'sm' | 'md' | 'lg';
  /** Optional leading icon node (e.g. an inline SVG) */
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Stretch to fill the container width */
  fullWidth?: boolean;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Mono-label, uppercase button with a press-scale feedback state.
 * @startingPoint section="Core" subtitle="Mono uppercase button, 6 variants" viewport="700x140"
 */
export function Button(props: ButtonProps): JSX.Element;
