/** Simple line icons for the equipment filter, drawn for this app (24×24, currentColor). */
export function EquipmentIcon({ type }: { type: string }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 36,
    height: 36,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  switch (type) {
    case 'barbell':
      return (
        <svg {...common}>
          <path d="M2 12h20" />
          <rect x="4" y="7" width="2.5" height="10" rx="1" />
          <rect x="17.5" y="7" width="2.5" height="10" rx="1" />
          <rect x="6.5" y="9" width="1.5" height="6" rx=".5" />
          <rect x="16" y="9" width="1.5" height="6" rx=".5" />
        </svg>
      )
    case 'dumbbell':
      return (
        <svg {...common}>
          <path d="M8 12h8" />
          <rect x="4" y="8" width="4" height="8" rx="1.2" />
          <rect x="16" y="8" width="4" height="8" rx="1.2" />
          <path d="M2.5 10.5v3M21.5 10.5v3" />
        </svg>
      )
    case 'machine':
      // Weight stack with a seat.
      return (
        <svg {...common}>
          <path d="M5 21V3M5 3h9" />
          <rect x="9" y="12" width="5" height="7" rx="1" />
          <path d="M9 14.5h5M9 17h5M11.5 3v9" />
          <path d="M16 21v-5h4v5" />
        </svg>
      )
    case 'cable':
      // Pulley at the top, rope down to a handle.
      return (
        <svg {...common}>
          <path d="M4 3h16" />
          <circle cx="12" cy="6.5" r="2.5" />
          <path d="M12 9v8" />
          <path d="M8.5 19.5c0-1.5 1.5-2.5 3.5-2.5s3.5 1 3.5 2.5" />
          <path d="M8.5 19.5h7" />
        </svg>
      )
    case 'bodyweight':
      return (
        <svg {...common}>
          <circle cx="12" cy="4.5" r="2" />
          <path d="M12 7v7M7 9.5l5-1.5 5 1.5M12 14l-3 7M12 14l3 7" />
        </svg>
      )
    default:
      // "Other": kettlebell-ish shape.
      return (
        <svg {...common}>
          <path d="M9 7a3 3 0 0 1 6 0" />
          <path d="M7.5 9h9a3 3 0 0 1 2.8 4l-1.3 4.5A3 3 0 0 1 15.1 20H8.9A3 3 0 0 1 6 17.5L4.7 13a3 3 0 0 1 2.8-4Z" />
        </svg>
      )
  }
}
