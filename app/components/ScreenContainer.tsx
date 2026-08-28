import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { spacing } from '../theme';

export function ScreenContainer({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 540;

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: t.background,
          padding: isMobile ? spacing.md : spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
