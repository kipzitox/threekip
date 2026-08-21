import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { WEB_APP_URL } from './config';

// Engine loading mode. The goal of FASE 6 is "local": the engine ships inside
// the app and is opened via file:// — no GitHub Pages, no localhost, no server.
//
//   web            -> served from a remote URL (legacy / browser)
//   react-native   -> rendered inside the RN WebView (this app)
//   local          -> loaded from bundled files via file:// (offline)
export type EngineMode = 'web' | 'react-native' | 'local';

export const ENGINE_MODE: EngineMode = 'local';

export type EngineSource = { uri: string };

function isExpoGo(): boolean {
  // Expo Go cannot bundle arbitrary folders, so fall back to the remote URL.
  return (
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo'
  );
}

function forcedRemote(): boolean {
  return (process.env.EXPO_PUBLIC_ENGINE_MODE as string | undefined) === 'remote';
}

// Resolve where the WebView should load index.html from.
// Priority: env override -> Expo Go remote fallback -> bundled file:// (offline).
export function getEngineSource(): EngineSource {
  if (forcedRemote() || isExpoGo()) {
    return { uri: WEB_APP_URL };
  }

  if (Platform.OS === 'android') {
    // Files placed in android/app/src/main/assets are reachable via android_asset.
    return { uri: 'file:///android_asset/engine/index.html' };
  }

  // iOS: engine folder must be added as an iOS bundle resource (see plugin +
  // docs/webview-local.md). If a resolved path was injected, use it; otherwise
  // keep Expo Go / online fallback so the app still launches.
  const iosUri = (Constants.expoConfig as unknown as { extra?: { engineIosUri?: string } })
    ?.extra?.engineIosUri;
  if (iosUri) return { uri: iosUri };

  return { uri: WEB_APP_URL };
}
