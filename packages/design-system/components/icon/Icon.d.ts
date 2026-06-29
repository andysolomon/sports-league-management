import * as React from 'react';

export type IconName =
  | 'trophy' | 'grid' | 'compass' | 'users' | 'target' | 'calendar'
  | 'layers' | 'upload' | 'card' | 'search' | 'plus' | 'x' | 'check'
  | 'check-circle' | 'chevron-down' | 'chevron-up' | 'chevron-right'
  | 'chevron-vertical' | 'sun' | 'moon' | 'alert' | 'user' | 'logout'
  | 'pencil' | 'trash' | 'bell';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  /** Which glyph to render. */
  name: IconName;
  /** Square size in px. Default 16. */
  size?: number;
  /** Stroke width on the 24px grid. Default 1.9. */
  strokeWidth?: number;
}

/** Lucide-style inline icon; inherits color via currentColor. */
export declare function Icon(props: IconProps): JSX.Element;
