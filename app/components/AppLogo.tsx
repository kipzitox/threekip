import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from '../ui/primitives';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme';

// Placeholder brand mark for ThreeKip. Replace the inner glyph with the final
// logo asset when available — the rounded container is the reserved logo space.
export function AppLogo({ size = 96 }: { size?: number }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius: radius.lg,
          backgroundColor: t.primary,
        },
      ]}
    >
      <Icon name="mdi-cube" size={size * 0.46} color={t.onPrimary} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
