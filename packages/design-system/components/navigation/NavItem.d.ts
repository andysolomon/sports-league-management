import * as React from 'react';
import type { IconName } from '../icon/Icon';

export interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading icon. */
  icon?: IconName;
  /** Selected state — primary fill. */
  active?: boolean;
}

/** One row in the app sidebar. Exactly one should be `active`. */
export declare function NavItem(props: NavItemProps): JSX.Element;
