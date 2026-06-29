import * as React from 'react';

export interface SwitchProps {
  /** Current state (controlled). */
  checked: boolean;
  /** Called with the next state on toggle. */
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/** Binary toggle for settings (e.g. live-data sync). Controlled — own the `checked` state. */
export declare function Switch(props: SwitchProps): JSX.Element;
