import * as React from 'react';

export interface Column<T> {
  key: keyof T & string;
  header: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable key per row. */
  rowKey: (row: T) => string;
  /** Optional trailing actions cell renderer. */
  actions?: (row: T) => React.ReactNode;
}

/** Lightweight table with mono uppercase headers. For dense roster/division lists. */
export declare function Table<T>(props: TableProps<T>): JSX.Element;
