/**
 * Theme preference, kept outside React for the same reason the sidebar's is:
 * `useSyncExternalStore` can render the server snapshot during hydration and
 * swap in the stored value afterwards, with no setState-in-effect.
 *
 * "system" is the default and is not a third set of colours — it simply leaves
 * `data-theme` off the element, which is what lets the `prefers-color-scheme`
 * block in globals.css decide.
 */

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "stealth:theme";

let listeners: Array<() => void> = [];
let cached: Theme | null = null;

export function subscribe(cb: () => void): () => void {
  listeners = [...listeners, cb];
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

export function getSnapshot(): Theme {
  if (cached === null) cached = read();
  return cached;
}


export function setTheme(next: Theme) {
  cached = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Non-fatal: the preference just won't survive a reload.
  }
  apply(next);
  for (const l of listeners) l();
}

function read(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage disabled — following the OS is a fine default.
  }
  return "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/**
 * Runs before first paint, inlined in the document head. Without it the page
 * would paint the system theme and then snap to the stored one — the flash that
 * every theme toggle is judged by.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
