import React from 'react';

/** Big-number metric with an uppercase label. Set `accent` to color the number. */
export function Stat({ value, label, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span className="sl-stat__value" style={accent ? { color: 'var(--accent)' } : undefined}>{value}</span>
      <span className="sl-stat__label">{label}</span>
    </div>
  );
}
