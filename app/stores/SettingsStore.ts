import { create } from 'zustand';
import { WEB_APP_URL } from '../services/config';

export type Language = 'es' | 'en';

const getInitialLanguage = (): Language => {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('threekip_language');
      if (saved === 'es' || saved === 'en') return saved;
    } catch {}
  }
  return 'es';
};

interface SettingsState {
  webAppUrl: string;
  hardwareAcceleration: boolean;
  resetCamOnOpen: boolean;
  confirmExit: boolean;
  language: Language;
  setWebAppUrl: (url: string) => void;
  setHardwareAcceleration: (value: boolean) => void;
  setResetCamOnOpen: (value: boolean) => void;
  setConfirmExit: (value: boolean) => void;
  setLanguage: (lang: Language) => void;
}

// App-level settings only. Does NOT store any engine/sketch information.
export const useSettingsStore = create<SettingsState>((set) => ({
  webAppUrl: WEB_APP_URL,
  hardwareAcceleration: true,
  resetCamOnOpen: false,
  confirmExit: false,
  language: getInitialLanguage(),
  setWebAppUrl: (url) => set({ webAppUrl: url }),
  setHardwareAcceleration: (value) => set({ hardwareAcceleration: value }),
  setResetCamOnOpen: (value) => set({ resetCamOnOpen: value }),
  setConfirmExit: (value) => set({ confirmExit: value }),
  setLanguage: (lang) => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('threekip_language', lang);
      } catch {}
    }
    set({ language: lang });
  },
}));
