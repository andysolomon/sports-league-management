import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Control height. Default 'md'. */
  inputSize?: 'sm' | 'md' | 'lg';
}

/** Single-line text field. Forwards all native input props (placeholder, value, onChange, disabled…). */
export declare function Input(props: InputProps): JSX.Element;
