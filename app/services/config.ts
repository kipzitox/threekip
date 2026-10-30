// Where the WebView loads the Sketchbook engine from.
//
// In production the engine ships inside the app (see engineLoader.ts), so this
// URL is only a fallback for Expo Go / iOS development. Point it anywhere with
// an environment variable — no private deployment URL lives in the repo:
//
//   EXPO_PUBLIC_WEB_URL=http://192.168.1.20:3000
//
// The default is a local dev server, which is what the README documents.

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_DEV_URL = 'http://localhost:3000';

function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  // Expo Go on a physical device: the dev server runs on the computer, so
  // reach it through the LAN host that Metro reports.
  if (Constants.expoConfig?.hostUri) {
    return `http://${Constants.expoConfig.hostUri.split(':')[0]}:3000`;
  }

  // Production or standalone fallback (if local assets fail).
  return DEFAULT_DEV_URL;
}

const baseUrl = resolveBaseUrl();

export const WEB_APP_URL = `${baseUrl}/engine/index.html`;
