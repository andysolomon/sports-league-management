import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export type Theme = 'light' | 'dark';
export type Accent = 'green' | 'blue' | 'violet' | 'orange';
export type Round = 'sharp' | 'default' | 'soft';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  accent: Accent;
  setAccent: (a: Accent) => void;
  round: Round;
  setRound: (r: Round) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultAccent?: Accent;
  defaultRound?: Round;
  /** Extra className merged onto the root element. */
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps the app, owns theme state, and writes `data-theme` / `data-accent`
 * / `data-round` onto a `.sl-root` element so every CSS variable resolves.
 * Import `tokens.css` once at your app entry.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  defaultAccent = 'green',
  defaultRound = 'default',
  className = '',
  style,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [accent, setAccent] = useState<Accent>(defaultAccent);
  const [round, setRound] = useState<Round>(defaultRound);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    []
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme, accent, setAccent, round, setRound }),
    [theme, toggleTheme, accent, round]
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={`sl-root ${className}`.trim()}
        data-theme={theme}
        data-accent={accent}
        data-round={round}
        style={style}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>');
  return ctx;
}
