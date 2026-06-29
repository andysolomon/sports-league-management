import * as React from 'react';

export interface AvatarProps {
  /** Initials shown when no `src`. */
  initials?: string;
  /** Image URL. */
  src?: string;
  alt?: string;
  /** Diameter in px. Default 32. */
  size?: number;
}

/** User/team avatar. Falls back to initials on accent-soft. Overlap several with negative margins for a stack. */
export declare function Avatar(props: AvatarProps): JSX.Element;
