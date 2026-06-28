import * as React from 'react';
import type { IconName } from '../icon/Icon';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Glyph to show. */
  icon: IconName;
}

/** Compact icon-only button for toolbars (theme toggle, close, overflow). Always pass an aria-label. */
export declare function IconButton(props: IconButtonProps): JSX.Element;
