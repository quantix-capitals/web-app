"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/format";
import {
  getServerSnapshot,
  getSnapshot,
  setTheme,
  subscribe,
  type Theme,
} from "./theme-store";

/**
 * A three-way segmented control: light, dark, follow the OS. It is a radiogroup
 * rather than a switch because "system" is a real third answer, not the absence
 * of a choice — and a two-state switch cannot say it.
 */
const OPTIONS: Array<{ value: Theme; label: string; icon: () => React.ReactNode }> = [
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
  { value: "system", label: "System", icon: IconSystem },
];

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex gap-1 rounded-xl border border-line bg-sunken p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              selected
                ? "bg-surface text-accent-ink shadow-card"
                : "text-ink-subtle hover:text-ink-muted",
            )}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}

/** Matches the 24px stroke grid the nav icons are drawn on. */
function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-[18px]"
    >
      {children}
    </svg>
  );
}

function IconSun() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2M20 12h2M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
    </Svg>
  );
}

function IconMoon() {
  return (
    <Svg>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
    </Svg>
  );
}

/** Half-filled square: the OS deciding between the two beside it. */
function IconSystem() {
  return (
    <Svg>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M12 8.5a3.5 3.5 0 0 1 0 7Z" fill="currentColor" />
    </Svg>
  );
}
