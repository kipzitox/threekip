import React, { createContext, useContext } from 'react';
import { useUIStore } from '../stores/UIStore';
import { light, dark, Theme } from './colors';

const ThemeContext = createContext<Theme>(light);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useUIStore((s) => s.themeMode);
  return (
    <ThemeContext.Provider value={mode === 'dark' ? dark : light}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
