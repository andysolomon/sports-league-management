import React from 'react';
import { Icon } from '../icon/Icon.jsx';

/** Breadcrumb trail; last item is emphasized. */
export function Breadcrumb({ items }) {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 13px/1 var(--font-sans)', color: 'var(--text-muted)' }}>
      {items.map((item, i) => (
        <React.Fragment key={item}>
          {i > 0 && <Icon name="chevron-right" size={13} strokeWidth={2} />}
          <span style={i === items.length - 1 ? { color: 'var(--text)' } : undefined}>{item}</span>
        </React.Fragment>
      ))}
    </nav>
  );
}
