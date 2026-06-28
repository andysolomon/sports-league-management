import * as React from 'react';

export interface SegmentedProps {
  options: string[];
  value: string;
  onChange?: (option: string) => void;
}

/** Inline segmented toggle (Active/Completed/Upcoming, accent picker, …). Controlled. Keep labels short. */
export declare function Segmented(props: SegmentedProps): JSX.Element;
