import React from 'react';

/** Page title + optional description on the left, actions slot on the right. */
export function PageHeader({ title, description, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, font: '700 25px/1 var(--font-sans)', letterSpacing: '-0.7px', color: 'var(--text)' }}>{title}</h1>
        {description && <p style={{ margin: '8px 0 0', font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-muted)', maxWidth: 600 }}>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
