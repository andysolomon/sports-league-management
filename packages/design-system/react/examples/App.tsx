import React from 'react';
import { ThemeProvider, useTheme, IconButton, Segmented } from '../src';
import { DiscoverScreen } from './DiscoverScreen';
import '../tokens.css';

/**
 * Mount point. Wrap the whole app in <ThemeProvider>; everything inside
 * reads the CSS variables and re-themes instantly.
 */
export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" defaultAccent="green" style={{ minHeight: '100vh' }}>
      <Demo />
    </ThemeProvider>
  );
}

function Demo() {
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <strong style={{ font: '700 16px/1 inherit', letterSpacing: '-0.2px' }}>Sports League · React</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Segmented
            options={['green', 'blue', 'violet', 'orange']}
            value={accent}
            onChange={(a) => setAccent(a as typeof accent)}
          />
          <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} aria-label="Toggle theme" onClick={toggleTheme} />
        </div>
      </header>
      <DiscoverScreen />
    </div>
  );
}
