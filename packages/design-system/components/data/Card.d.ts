import * as React from 'react';

/**
 * @startingPoint section="Surfaces" subtitle="Bordered content surface" viewport="700x150"
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

/** Primary content surface (`--surface` bg, hairline border, `--r-lg` radius). Forwards div props. */
export declare function Card(props: CardProps): JSX.Element;
