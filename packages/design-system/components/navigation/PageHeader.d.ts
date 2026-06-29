import * as React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions (e.g. a primary Button). */
  actions?: React.ReactNode;
}

/** Standard page header: title + supporting copy, with an actions slot. Pair with Breadcrumb above. */
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
