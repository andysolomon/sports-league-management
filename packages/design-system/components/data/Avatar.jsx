import React from 'react';

/** Round avatar showing an image or initials (accent-soft fallback). */
export function Avatar({ initials, src, alt = '', size = 32 }) {
  return (
    <span className="sl-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {src ? <img src={src} alt={alt} /> : initials}
    </span>
  );
}
