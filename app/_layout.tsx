import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from './providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar />
      <Stack
        initialRouteName="index"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="library" />
        <Stack.Screen name="editor" />
        <Stack.Screen
          name="settings"
          options={{ headerShown: true, title: 'Ajustes' }}
        />
        <Stack.Screen
          name="about"
          options={{ headerShown: true, title: 'Acerca de' }}
        />
      </Stack>
    </AppProviders>
  );
}
