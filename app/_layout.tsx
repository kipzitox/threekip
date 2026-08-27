import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from './providers';
import { useI18n } from './i18n';
import { useTheme } from './theme/ThemeProvider';

function NavigationStack() {
  const { t: tr } = useI18n();
  const t = useTheme();

  return (
    <Stack
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        headerStyle: { backgroundColor: t.surfaceContainer },
        headerTintColor: t.onSurface,
        headerTitleStyle: { color: t.onSurface, fontWeight: '600', fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="library" />
      <Stack.Screen name="editor" />
      <Stack.Screen
        name="settings"
        options={{ headerShown: true, title: tr.settings.title }}
      />
      <Stack.Screen
        name="about"
        options={{ headerShown: true, title: tr.about.title }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar />
      <NavigationStack />
    </AppProviders>
  );
}
