import { create } from 'zustand';
import { WEB_APP_URL } from '../services/config';

interface SettingsState {
  webAppUrl: string;
  hardwareAcceleration: boolean;
  resetCamOnOpen: boolean;
  confirmExit: boolean;
  setWebAppUrl: (url: string) => void;
  setHardwareAcceleration: (value: boolean) => void;
  setResetCamOnOpen: (value: boolean) => void;
  setConfirmExit: (value: boolean) => void;
}

// App-level settings only. Does NOT store any engine/sketch information.
export const useSettingsStore = create<SettingsState>((set) => ({
  webAppUrl: WEB_APP_URL,
  hardwareAcceleration: true,
  resetCamOnOpen: false,
  confirmExit: false,
  setWebAppUrl: (url) => set({ webAppUrl: url }),
  setHardwareAcceleration: (value) => set({ hardwareAcceleration: value }),
  setResetCamOnOpen: (value) => set({ resetCamOnOpen: value }),
  setConfirmExit: (value) => set({ confirmExit: value }),
}));
