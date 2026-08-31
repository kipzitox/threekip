// URL of the EXISTING web dev server that serves the Sketchbook engine.
// During FASE 5 we point the WebView at the running dev server.
// Do NOT copy the HTML into Expo and do NOT change engine routes (later phase).
//
// For Expo Go on a physical device, the dev server runs on your computer, so the
// WebView must reach it via your machine's LAN IP, e.g.:
//   EXPO_PUBLIC_WEB_URL=http://192.168.1.20:8765/index.html
// The default assumes the dev server runs on localhost:3000 or production domain.

import { Platform } from 'react-native';
import Constants from 'expo-constants';

let baseUrl = '';

if (Platform.OS === 'web') {
  baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
} else if (Constants.expoConfig?.hostUri) {
  // If running in Expo Go locally, derive the host from hostUri
  baseUrl = `http://${Constants.expoConfig.hostUri.split(':')[0]}:3000`;
} else {
  // Production or standalone fallback (if local assets fail)
  baseUrl = 'http://localhost:3000';
}

export const WEB_APP_URL = `${baseUrl}/engine/index.html`;
