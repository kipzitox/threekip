import { Platform } from 'react-native';

const m3Font = Platform.select({
  web: 'Roboto, "Google Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: undefined,
});

export const font = {
  regular: m3Font,
  medium: m3Font,
  semi: m3Font,
  bold: m3Font,
};

export const typography = {
  // M3 Display & Headlines
  displayLarge: { fontSize: 40, fontFamily: font.bold, lineHeight: 48, fontWeight: '700' as const, letterSpacing: -0.25 },
  display: { fontSize: 32, fontFamily: font.bold, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.2 },
  displaySmall: { fontSize: 28, fontFamily: font.bold, lineHeight: 36, fontWeight: '700' as const, letterSpacing: 0 },
  headlineLarge: { fontSize: 28, fontFamily: font.bold, lineHeight: 36, fontWeight: '700' as const, letterSpacing: 0 },
  headline: { fontSize: 24, fontFamily: font.bold, lineHeight: 32, fontWeight: '700' as const, letterSpacing: 0 },
  headlineSmall: { fontSize: 20, fontFamily: font.bold, lineHeight: 28, fontWeight: '700' as const, letterSpacing: 0 },
  titleLarge: { fontSize: 22, fontFamily: font.semi, lineHeight: 28, fontWeight: '600' as const, letterSpacing: 0 },
  title: { fontSize: 20, fontFamily: font.semi, lineHeight: 28, fontWeight: '600' as const, letterSpacing: 0.15 },
  titleMedium: { fontSize: 16, fontFamily: font.medium, lineHeight: 24, fontWeight: '500' as const, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, fontFamily: font.medium, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  subtitle: { fontSize: 16, fontFamily: font.medium, lineHeight: 24, fontWeight: '500' as const, letterSpacing: 0.15 },
  // M3 Body
  bodyLarge: { fontSize: 16, fontFamily: font.regular, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  body: { fontSize: 14, fontFamily: font.regular, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodyMedium: { fontSize: 14, fontFamily: font.regular, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, fontFamily: font.regular, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
  // M3 Labels & Buttons
  labelLarge: { fontSize: 14, fontFamily: font.medium, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, fontFamily: font.medium, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
  label: { fontSize: 13, fontFamily: font.medium, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, fontFamily: font.medium, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
  caption: { fontSize: 12, fontFamily: font.regular, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
};
