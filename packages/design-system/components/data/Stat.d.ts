import * as React from 'react';

export interface StatProps {
  value: React.ReactNode;
  label: React.ReactNode;
  /** Color the value with --accent (e.g. live totals). */
  accent?: boolean;
}

/** KPI display: large value over a small uppercase label. Lay several out in a flex row. */
export declare function Stat(props: StatProps): JSX.Element;
