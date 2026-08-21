import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { ScreenContainer } from './components/ScreenContainer';
import { useTheme } from './theme/ThemeProvider';
import { spacing, typography } from './theme';

export default function About() {
  const t = useTheme();
  return (
    <ScreenContainer>
      <Text style={[styles.title, { color: t.text }]}>ThreeKip</Text>
      <Text style={[styles.body, { color: t.text }]}>
        Aplicación profesional de modelado 3D.
      </Text>
      <Text style={[styles.muted, { color: t.textMuted }]}>
        El motor se renderiza dentro de un WebView de React Native, totalmente
        desacoplado de la interfaz.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.title.fontSize,
    fontFamily: typography.title.fontFamily,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: typography.body.fontSize,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.sm,
  },
  muted: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
  },
});
