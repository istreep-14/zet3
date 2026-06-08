import * as React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  /** Color treatment. Role variants match the staff color-coding. */
  variant?: 'neutral' | 'bartender' | 'server' | 'support' | 'closer' | 'bonus';
  /** Fully-rounded pill shape — used for the green "+$24" bonus marker */
  pill?: boolean;
  style?: React.CSSProperties;
}

/**
 * Tiny uppercase mono label for roles, closer status, tags, and bonus pills.
 * @startingPoint section="Core" subtitle="Role tags, closer marker, bonus pill" viewport="700x120"
 */
export function Badge(props: BadgeProps): JSX.Element;
