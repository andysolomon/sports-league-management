import React from 'react';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Controlled on/off toggle. Track turns accent when on. */
export function Switch({ checked, onChange, disabled, ...aria }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx('sl-switch', checked && 'is-on')}
      onClick={() => onChange && onChange(!checked)}
      {...aria}
    >
      <span className="sl-switch__knob" />
    </button>
  );
}
