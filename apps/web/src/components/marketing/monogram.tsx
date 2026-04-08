interface MonogramProps {
  size?: number;
  className?: string;
}

export function Monogram({ size = 32, className }: MonogramProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="8" fill="#2563eb" />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="22"
        fontWeight="800"
        fill="#ffffff"
      >
        S
      </text>
    </svg>
  );
}
