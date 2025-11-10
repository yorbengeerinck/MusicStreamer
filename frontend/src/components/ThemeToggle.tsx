type Props = {
  darkMode: boolean;
  onToggle: (next?: boolean) => void;
};

export default function ThemeToggle({ darkMode, onToggle }: Props) {
  const isDark = !!darkMode;
  return (
    <button
      type="button"
      className="theme-toggle-btn"
      data-mode={isDark ? "dark" : "light"}
      aria-pressed={isDark}
      onClick={() => onToggle(!isDark)}
      title={`Schakel naar ${isDark ? "licht" : "donker"} thema`}
    >
      <span className="theme-icn" aria-hidden="true">
        {isDark ? "🌙" : "☀️"}
      </span>
      <span className="theme-label">{isDark ? "Donker" : "Licht"}</span>
    </button>
  );
}