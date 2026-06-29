import React from 'react';
import { Icon } from '../icon/Icon.jsx';

/** Inline status banner. `success` (accent-soft) or `danger` (bordered). */
export function Banner({ variant = 'success', className, children, ...rest }) {
  const cls = ['sl-banner', `sl-banner--${variant}`, className].filter(Boolean).join(' ');
  return (
    <div className={cls} {...rest}>
      <span className="sl-banner__icon">
        <Icon name={variant === 'success' ? 'check-circle' : 'alert'} size={17} strokeWidth={2.1} />
      </span>
      <span>{children}</span>
    </div>
  );
}
