import * as React from 'react';

export interface TabsProps {
  tabs: string[];
  value: string;
  onChange?: (tab: string) => void;
}

/** Underlined tab bar for switching views within a page. Controlled. */
export declare function Tabs(props: TabsProps): JSX.Element;
