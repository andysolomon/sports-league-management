import React from 'react';
import { Icon } from '../icon/Icon.jsx';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Sidebar navigation row. `active` paints the high-contrast primary fill. */
export function NavItem({ icon, active, className, children, ...rest }) {
  return (
    <button className={cx('sl-nav', active && 'is-active', className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}
