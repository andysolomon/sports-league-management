import React from 'react';
import { Icon } from '../icon/Icon.jsx';

const cx = (...p) => p.filter(Boolean).join(' ');

/**
 * Primary action element. Variants: primary (high-contrast), secondary
 * (bordered), ghost (text), danger. Sizes sm/md/lg. Optional leading icon.
 */
export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }) {
  return (
    <button
      className={cx('sl-btn', `sl-btn--${variant}`, size !== 'md' && `sl-btn--${size}`, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 16 : 14} strokeWidth={2.2} />}
      {children}
    </button>
  );
}
