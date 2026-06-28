import React from 'react';

export type IconName =
  | 'trophy' | 'grid' | 'compass' | 'users' | 'target' | 'calendar'
  | 'layers' | 'upload' | 'card' | 'search' | 'plus' | 'x' | 'check'
  | 'check-circle' | 'chevron-down' | 'chevron-up' | 'chevron-right'
  | 'chevron-vertical' | 'sun' | 'moon' | 'alert' | 'user' | 'logout'
  | 'pencil' | 'trash' | 'bell';

const PATHS: Record<IconName, React.ReactNode> = {
  trophy: <><path d="M6 9a6 6 0 0 0 12 0V4H6Z" /><path d="M9 20h6M12 14v6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-4 1 2-5z" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 6.2a3 3 0 0 1 0 5.6" /><path d="M20.5 20a5 5 0 0 0-4-4.9" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.4" /></>,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  upload: <><path d="M12 15V3M8 7l4-4 4 4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-3.6-3.6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><path d="m9 12 2 2 4-4" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m18 15-6-6-6 6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-vertical': <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  alert: <><path d="M12 3 2 20h20Z" /><path d="M12 10v4M12 17.5v.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  pencil: <path d="M12 20h9M16.5 3.5a2.05 2.05 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
};

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, strokeWidth = 1.9, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth as number}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
