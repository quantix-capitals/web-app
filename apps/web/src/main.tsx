import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./globals.css";

/**
 * After a deploy, the old build's route chunks stop existing, so a tab left open
 * on it 404s the moment it lazy-loads one. Vite fires this event for exactly
 * that failure — reload once to pick up the new build rather than showing the
 * user a broken page. The timestamp guard is what stops a genuinely missing
 * chunk from becoming a reload loop.
 */
window.addEventListener("vite:preloadError", () => {
  const key = "stealth:preload-reload-at";
  const last = Number(sessionStorage.getItem(key) ?? 0);
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
