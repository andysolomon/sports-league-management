import * as React from 'react';

export interface BreadcrumbProps {
  /** Ordered trail; the last is the current page. */
  items: string[];
}

/** Path trail above a page title. Chevron-separated; final crumb emphasized. */
export declare function Breadcrumb(props: BreadcrumbProps): JSX.Element;
