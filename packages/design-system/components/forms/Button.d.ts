import * as React from 'react';
import type { IconName } from '../icon/Icon';

/**
 * @startingPoint section="Forms" subtitle="Themeable action button — 4 variants, 3 sizes" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. Default 'secondary'. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Control height. Default 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional leading icon name. */
  icon?: IconName;
}

/** High-contrast themeable button. Use `primary` for the main action per view; `danger` for destructive. */
export declare function Button(props: ButtonProps): JSX.Element;
