import type { ComponentType } from "react";

/**
 * 24px stroke icons, drawn on a shared grid so the collapsed rail reads evenly.
 * Colour comes from `currentColor` — the sidebar owns active/hover state.
 */
type IconProps = { className?: string };

function Svg({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "size-[18px] shrink-0"}
    >
      {children}
    </svg>
  );
}

export const IconOverview: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.6" />
    <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.6" />
    <rect x="13.5" y="11" width="7.5" height="10" rx="1.6" />
  </Svg>
);

/** Portfolio: positions stacked in a book. */
export const IconPortfolio: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="6.5" width="19" height="13.5" rx="2.2" />
    <path d="M8.5 6.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
    <path d="M2.5 12h19" />
    <path d="M10.5 12v2h3v-2" />
  </Svg>
);

/** Watchlist: the eye — things you're carrying but haven't bought. */
export const IconWatchlist: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3.2" />
  </Svg>
);

/** Momentum: the breakout — a rising leg with its own trend line behind it. */
export const IconMomentum: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 17.5 8.5 12l3.5 3.5L20.5 7" />
    <path d="M15.5 7h5v5" />
    <path d="M3 21h18" opacity="0.45" />
  </Svg>
);

export const IconProfile: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.2a7.6 7.6 0 0 1 15 0" />
  </Svg>
);

export const IconAgent: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="4" y="7.5" width="16" height="12" rx="3" />
    <path d="M12 3v4.5M9 13v1.5M15 13v1.5" />
    <path d="M4 12.5H2.5M21.5 12.5H20" />
  </Svg>
);

export const IconChevron: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);

export const IconMenu: ComponentType<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);
