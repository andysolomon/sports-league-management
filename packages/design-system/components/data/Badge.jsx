import React from 'react';
import { Icon } from '../icon/Icon.jsx';

const cx = (...p) => p.filter(Boolean).join(' ');

/** Pill label for status/metadata. Variants outline/neutral/solid/success/danger; optional dot or icon. */
export function Badge({ variant = 'neutral', dot, icon, className, children, ...rest }) {
  return (
    <span className={cx('sl-badge', `sl-badge--${variant}`, className)} {...rest}>
      {dot && <span className="sl-badge__dot" />}
      {icon && <Icon name={icon} size={12} strokeWidth={2.6} />}
      {children}
    </span>
  );
}
