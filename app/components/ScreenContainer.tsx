import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useResponsive } from '../theme';

export function ScreenContainer({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const { gutter } = useResponsive();

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor: t.background,
          padding: gutter,
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
