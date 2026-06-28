import React from 'react';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Segmented control — pill group for 2–4 mutually exclusive options. */
export function Segmented({ options, value, onChange }) {
  return (
    <div className="sl-segmented" role="tablist">
      {options.map((o) => (
        <button key={o} role="tab" aria-selected={o === value} className={cx('sl-segmented__item', o === value && 'is-active')} onClick={() => onChange && onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
