import * as React from 'react';

export interface RadioProps {
  checked: boolean;
  onChange?: () => void;
  label?: React.ReactNode;
}

/** Single radio option; group several and own the selected value in the parent. */
export declare function Radio(props: RadioProps): JSX.Element;
