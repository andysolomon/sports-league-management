import React from 'react';
import { Icon } from '../icon/Icon.jsx';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Native select styled to match inputs, with a token-colored chevron. */
export function Select({ className, children, ...rest }) {
  return (
    <span className="sl-select-wrap">
      <select className={cx('sl-select', className)} {...rest}>{children}</select>
      <span className="sl-select-wrap__chevron"><Icon name="chevron-down" size={15} strokeWidth={2} /></span>
    </span>
  );
}
