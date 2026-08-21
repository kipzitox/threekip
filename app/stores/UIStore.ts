import { create } from 'zustand';

interface UIState {
  isLoading: boolean;
  themeMode: 'light' | 'dark';
  setLoading: (value: boolean) => void;
  toggleTheme: () => void;
}

// UI-only state. Never stores engine/sketch data.
export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  themeMode: 'light',
  setLoading: (value) => set({ isLoading: value }),
  toggleTheme: () =>
    set((state) => ({ themeMode: state.themeMode === 'light' ? 'dark' : 'light' })),
}));
