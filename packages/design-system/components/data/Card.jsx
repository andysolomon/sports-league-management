import React from 'react';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Bordered surface container at card radius. Compose anything inside. */
export function Card({ className, ...rest }) {
  return <div className={cx('sl-card', className)} {...rest} />;
}
