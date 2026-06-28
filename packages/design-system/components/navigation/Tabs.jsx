import React from 'react';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Underline tab bar. Controlled via `value`/`onChange` over a list of labels. */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="sl-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={t === value} className={cx('sl-tab', t === value && 'is-active')} onClick={() => onChange && onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}
