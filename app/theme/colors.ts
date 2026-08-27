export interface Theme {
  background: string;
  surface: string;
  surfaceDim: string;
  surfaceBright: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceAlt: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  text: string;
  textMuted: string;
  border: string;
  outline: string;
  outlineVariant: string;
  divider: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  success: string;
  overlay: string;
  shadowColor: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
}

export const light: Theme = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceDim: '#DED8E1',
  surfaceBright: '#FEF7FF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F7F2FA',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  surfaceContainerHighest: '#E6E0E9',
  surfaceAlt: '#E8DEF8',
  surfaceVariant: '#E7E0EC',
  onSurface: '#1D1B20',
  onSurfaceVariant: '#49454F',
  text: '#1D1B20',
  textMuted: '#49454F',
  border: '#CAC4D0',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  divider: '#E7E0EC',
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
  success: '#146C2E',
  overlay: 'rgba(29, 27, 32, 0.38)',
  shadowColor: '#000000',
  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#D0BCFF',
};

export const dark: Theme = {
  background: '#141218',
  surface: '#141218',
  surfaceDim: '#141218',
  surfaceBright: '#3B383E',
  surfaceContainerLowest: '#0F0D13',
  surfaceContainerLow: '#1D1B20',
  surfaceContainer: '#211F26',
  surfaceContainerHigh: '#2B2930',
  surfaceContainerHighest: '#36343B',
  surfaceAlt: '#2A2732',
  surfaceVariant: '#49454F',
  onSurface: '#E6E0E9',
  onSurfaceVariant: '#CAC4D0',
  text: '#E6E0E9',
  textMuted: '#CAC4D0',
  border: '#49454F',
  outline: '#938F99',
  outlineVariant: '#49454F',
  divider: '#36343B',
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',
  tertiary: '#EFB8C8',
  onTertiary: '#492532',
  tertiaryContainer: '#633B48',
  onTertiaryContainer: '#FFD8E4',
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',
  success: '#4ADE80',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadowColor: '#000000',
  inverseSurface: '#E6E0E9',
  inverseOnSurface: '#313033',
  inversePrimary: '#6750A4',
};

export const shadows = {
  level0: { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  level1: { shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  level2: { shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  level3: { shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  level4: { shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  level5: { shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  // Backward compatibility:
  sm: { shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  md: { shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  lg: { shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
};
