import * as React from 'react';

export interface SearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Trailing shortcut hint. Default '⌘K'. Pass '' to hide. */
  shortcut?: string;
}

/** Search input with leading icon and a keyboard-shortcut chip. Forwards native input props. */
export declare function Search(props: SearchProps): JSX.Element;
