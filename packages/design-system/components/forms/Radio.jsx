import React from 'react';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Controlled radio with an optional label. Ring fills with --accent when selected. */
export function Radio({ checked, onChange, label }) {
  return (
    <label className={cx('sl-control', !checked && 'sl-control--muted')} onClick={onChange}>
      <span className={cx('sl-radio', checked && 'is-on')} />
      {label}
    </label>
  );
}
