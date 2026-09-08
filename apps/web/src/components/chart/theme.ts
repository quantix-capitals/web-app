/**
 * The chart layer's colours, read from the same CSS custom properties every
 * other component uses.
 *
 * Highcharts wants concrete colour strings — it interpolates them, computes
 * gradients from them, and draws them into an SVG that a CSS variable cannot
 * reach. So the tokens in `globals.css` are resolved once per theme here, and
 * the charts are re-created when the resolved values change. Nothing in this
 * folder ever names a shade; if the palette moves, the charts move with it.
 */

import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe as subscribeTheme } from "@/components/shell/theme-store";

export interface ChartTheme {
  /** `light` or `dark` — what the tokens actually resolved to. */
  mode: "light" | "dark";
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  line: string;
  lineStrong: string;
  surface: string;
  canvas: string;
  sunken: string;
  gain: string;
  loss: string;
  gainSoft: string;
  lossSoft: string;
  /**
   * Categorical slots, in fixed order. Validated for colour-vision deficiency
   * against this app's own light and dark surfaces — see the note in
   * `chart.tsx`. Never cycled: nothing on this dashboard plots more than three
   * categorical series, and the pieces that would (per-holding lines) use small
   * multiples instead.
   */
  series: [string, string, string];
}

const TOKENS = [
  "--color-ink",
  "--color-ink-muted",
  "--color-ink-subtle",
  "--color-line",
  "--color-line-strong",
  "--color-surface",
  "--color-canvas",
  "--color-sunken",
  "--color-gain",
  "--color-loss",
  "--color-gain-soft",
  "--color-loss-soft",
] as const;

const SERIES_LIGHT: [string, string, string] = ["#2a78d6", "#eb6834", "#4a3aa7"];
const SERIES_DARK: [string, string, string] = ["#3987e5", "#d95926", "#9085e9"];

function resolve(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  const read = (token: string) => styles.getPropertyValue(token).trim();
  const [ink, inkMuted, inkSubtle, line, lineStrong, surface, canvas, sunken, gain, loss, gainSoft, lossSoft] =
    TOKENS.map(read);

  const attr = document.documentElement.getAttribute("data-theme");
  const mode: "light" | "dark" =
    attr === "dark" || attr === "light"
      ? attr
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  return {
    mode,
    ink,
    inkMuted,
    inkSubtle,
    line,
    lineStrong,
    surface,
    canvas,
    sunken,
    gain,
    loss,
    gainSoft,
    lossSoft,
    series: mode === "dark" ? SERIES_DARK : SERIES_LIGHT,
  };
}

// The resolved theme is cached and only recomputed when something actually
// changes it, because `getComputedStyle` forces a style recalculation and every
// chart on the page would otherwise trigger one per render.
let cached: ChartTheme | null = null;

function snapshot(): ChartTheme {
  if (!cached) cached = resolve();
  return cached;
}

/**
 * Two sources can change the answer: the app's own toggle, and the OS when the
 * toggle is on "system". Both invalidate the cache and wake every chart.
 */
function subscribe(onChange: () => void): () => void {
  const invalidate = () => {
    cached = null;
    onChange();
  };

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", invalidate);
  const stopTheme = subscribeTheme(invalidate);

  return () => {
    media.removeEventListener("change", invalidate);
    stopTheme();
  };
}

export function useChartTheme(): ChartTheme {
  // The theme store is read as well as subscribed to, so a preference change
  // that resolves to the same mode still re-runs this and can never be missed.
  useSyncExternalStore(subscribeTheme, getSnapshot, () => "system" as const);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/**
 * A colour at a given alpha, for area washes and plot bands.
 *
 * `color-mix` rather than parsing: the tokens arrive as `oklch(...)` and the
 * series slots as hex, and the browser can fade either without this module
 * learning a colour space. It resolves inside an SVG `fill` the same as it does
 * in CSS.
 */
export function alpha(color: string, amount: number): string {
  return `color-mix(in srgb, ${color.trim()} ${Math.round(amount * 100)}%, transparent)`;
}
