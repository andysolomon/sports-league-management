import React from 'react';
import { Icon } from '../icon/Icon.jsx';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Controlled checkbox with an optional label. Filled with --primary when on. */
export function Checkbox({ checked, onChange, label }) {
  return (
    <label className={cx('sl-control', !checked && 'sl-control--muted')} onClick={() => onChange && onChange(!checked)}>
      <span className={cx('sl-check', checked && 'is-on')}>
        <Icon name="check" size={12} strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}
