import type { ComponentType } from "react";
import {
  IconMomentum,
  IconOverview,
  IconPortfolio,
  IconProfile,
  IconWatchlist,
} from "./nav-icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Shown as a chip when the sidebar is expanded. */
  badge?: string;
  /** Nested routes that should still light this item up. */
  matchPrefix?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Desk",
    items: [
      { href: "/", label: "Overview", icon: IconOverview },
      { href: "/portfolio", label: "Portfolio", icon: IconPortfolio, matchPrefix: true },
      { href: "/watchlist", label: "Watchlist", icon: IconWatchlist, matchPrefix: true },
    ],
  },
  {
    title: "Research",
    items: [
      { href: "/momentum", label: "Momentum", icon: IconMomentum, matchPrefix: true },
    ],
  },
  {
    title: "Account",
    items: [{ href: "/profile", label: "Profile", icon: IconProfile, matchPrefix: true }],
  },
];

export function isActive(pathname: string, item: NavItem): boolean {
  return item.matchPrefix
    ? pathname === item.href || pathname.startsWith(`${item.href}/`)
    : pathname === item.href;
}
