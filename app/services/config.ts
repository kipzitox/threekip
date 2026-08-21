// URL of the EXISTING web dev server that serves the Sketchbook engine.
// During FASE 5 we point the WebView at the running dev server.
// Do NOT copy the HTML into Expo and do NOT change engine routes (later phase).
//
// For Expo Go on a physical device, the dev server runs on your computer, so the
// WebView must reach it via your machine's LAN IP, e.g.:
//   EXPO_PUBLIC_WEB_URL=http://192.168.1.20:8765/index.html
// The default assumes the dev server runs on localhost:8765 (web preview / emulator).
export const WEB_APP_URL =
  (process.env.EXPO_PUBLIC_WEB_URL as string | undefined) ??
  'http://localhost:8765/index.html';
