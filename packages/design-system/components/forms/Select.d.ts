import * as React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/** Styled native `<select>`. Pass `<option>` children; forwards value/onChange/disabled. */
export declare function Select(props: SelectProps): JSX.Element;
