import React from 'react';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Text input with token-driven focus ring. Sizes sm/md/lg via inputSize. */
export function Input({ inputSize = 'md', className, ...rest }) {
  return <input className={cx('sl-input', inputSize !== 'md' && `sl-input--${inputSize}`, className)} {...rest} />;
}
