import React from 'react';
import { ThemeProvider } from './theme/ThemeProvider';

// Provides the active light/dark theme to the tree. (Inter was swapped for the
// system Roboto family to avoid an extra native font dependency.)
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
