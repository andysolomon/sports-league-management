import React from 'react';

/** Simple data table. Columns map keys→headers; optional per-row actions cell. */
export function Table({ columns, rows, rowKey, actions }) {
  return (
    <table className="sl-table">
      <thead>
        <tr>
          {columns.map((c) => <th key={c.key}>{c.header}</th>)}
          {actions && <th style={{ textAlign: 'right' }}>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c) => <td key={c.key}>{String(row[c.key])}</td>)}
            {actions && <td style={{ textAlign: 'right' }}>{actions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
