import * as React from 'react';
import type { IconName } from '../icon/Icon';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Color treatment. Default 'neutral'. */
  variant?: 'outline' | 'neutral' | 'solid' | 'success' | 'danger';
  /** Show a leading accent dot (e.g. "active"). */
  dot?: boolean;
  /** Optional leading icon. */
  icon?: IconName;
}

/** Status / metadata pill. Use `success` for live/added states, `danger` for failures. */
export declare function Badge(props: BadgeProps): JSX.Element;
