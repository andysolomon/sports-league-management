import * as React from 'react';

export interface CheckboxProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label?: React.ReactNode;
}

/** Labeled checkbox for multi-select options. Controlled. */
export declare function Checkbox(props: CheckboxProps): JSX.Element;
