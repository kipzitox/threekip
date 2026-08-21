import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppLogo } from './components/AppLogo';
import { useTheme } from './theme/ThemeProvider';
import { spacing, typography } from './theme';

export default function Splash() {
  const t = useTheme();
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/library');
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <AppLogo size={110} />
      <Text style={[styles.name, { color: t.text }]}>ThreeKip</Text>
      <ActivityIndicator style={styles.spinner} color={t.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  name: {
    fontSize: typography.title.fontSize + 8,
    fontFamily: typography.title.fontFamily,
    fontWeight: '700',
  },
  spinner: {
    marginTop: spacing.md,
  },
});
