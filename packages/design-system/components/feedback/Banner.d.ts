import * as React from 'react';

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tone. Default 'success'. */
  variant?: 'success' | 'danger';
}

/** Inline feedback banner with a leading status icon. `success` for sync/confirmation, `danger` for errors. */
export declare function Banner(props: BannerProps): JSX.Element;
