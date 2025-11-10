export type Theme = "dark" | "light";
const THEME_KEY = "theme";

export function getSavedTheme(): Theme | null {
  const v = localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "light" ? v : null;
}

export function getSystemTheme(): Theme {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.body.classList.toggle("dark", theme === "dark");
  // helpt met native UI kleuren (inputs/scrollbars)
  document.documentElement.style.colorScheme = theme;
}

export function applyInitialTheme(): Theme {
  const saved = getSavedTheme();
  const theme = saved ?? getSystemTheme();
  applyTheme(theme);
  return theme;
}

export function setTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function listenSystemThemeChanges() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    if (!getSavedTheme()) {
      const t: Theme = e.matches ? "dark" : "light";
      applyTheme(t);
      window.dispatchEvent(new CustomEvent("themechange", { detail: t }));
    }
  };
  // brede compat
  // @ts-ignore
  (mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler));
  return () =>
    // @ts-ignore
    (mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler));
}

export function getCurrentTheme(): Theme {
  return document.body.classList.contains("dark") ? "dark" : "light";
}