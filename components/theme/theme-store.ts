// Theme preference, kept in localStorage and applied as a `.dark` class on
// <html> (see the `dark` custom variant in globals.css).
//
// The class is written in two places: the blocking script in the root layout
// (first paint) and `applyTheme` below (user toggles). Keeping both on the same
// rule — stored value, falling back to the OS preference — means they can't
// disagree about what "system" resolves to.

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "timeflow-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

// Inlined verbatim into a <script> in the root layout, so it must stay
// dependency-free and small. It runs before first paint, which is the whole
// point — resolving the theme in React instead would flash the light palette on
// every load for a dark-mode user.
export const THEME_SCRIPT = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(t!=="light"&&t!=="dark"&&t!=="system"){t="system"}
var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
document.documentElement.style.colorScheme=d?"dark":"light";
}catch(e){}})();`;

// ---- Client store ---------------------------------------------------------
// A tiny external store rather than context: the preference is read in one
// place, and useSyncExternalStore keeps the server snapshot ("system") matching
// the SSR HTML without a setState-in-effect cascade after mount.

let cache: Theme | null = null;
const listeners = new Set<() => void>();

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  // Tells the UA to render form controls, scrollbars and the canvas in the
  // matching palette — without it those stay light under a dark page.
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function readTheme(): Theme {
  if (cache === null) {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    cache = isTheme(stored) ? stored : "system";
  }
  return cache;
}

export function writeTheme(next: Theme) {
  cache = next;
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
  listeners.forEach((l) => l());
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  // While on "system", the OS switching schemes has to repaint the page too.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (readTheme() === "system") {
      applyTheme("system");
      listener();
    }
  };
  media.addEventListener("change", onMedia);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMedia);
  };
}
