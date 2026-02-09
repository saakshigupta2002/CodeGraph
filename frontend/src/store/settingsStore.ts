import { create } from 'zustand';
import type { Settings } from '../types';
import { api } from '../api/client';

interface SettingsState {
  settings: Settings | null;
  loading: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  setApiKey: (key: string) => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loading: false,

  loadSettings: async () => {
    try {
      const settings = await api.getSettings();
      set({ settings });
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },

  updateSettings: async (updates) => {
    set({ loading: true });
    try {
      await api.updateSettings(updates);
      const settings = await api.getSettings();
      set({ settings, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  setApiKey: async (key) => {
    set({ loading: true });
    try {
      await api.setApiKey(key);
      const settings = await api.getSettings();
      set({ settings, loading: false });
      return true;
    } catch (e) {
      set({ loading: false });
      return false;
    }
  },
}));
