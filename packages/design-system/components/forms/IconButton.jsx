import React from 'react';
import { Icon } from '../icon/Icon.jsx';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Square icon-only button (34px) with a bordered, ghost-style surface. */
export function IconButton({ icon, className, ...rest }) {
  return (
    <button className={cx('sl-iconbtn', className)} {...rest}>
      <Icon name={icon} size={17} />
    </button>
  );
}
