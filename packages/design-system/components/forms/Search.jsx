import React from 'react';
import { Icon } from '../icon/Icon.jsx';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Search field with a leading magnifier and a trailing keyboard shortcut hint. */
export function Search({ shortcut = '⌘K', placeholder = 'Search…', className, ...rest }) {
  return (
    <label className={cx('sl-search', className)}>
      <Icon name="search" size={14} strokeWidth={2} />
      <input placeholder={placeholder} {...rest} />
      {shortcut && <span className="sl-kbd">{shortcut}</span>}
    </label>
  );
}
