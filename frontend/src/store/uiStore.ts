import { create } from 'zustand';
import type { ToastMessage, BookmarkItem } from '../types';
import { api } from '../api/client';

interface UIState {
  // Panels
  searchOpen: boolean;
  settingsOpen: boolean;
  detailPanelOpen: boolean;
  detailPanelWidth: number;
  shortcutOverlayOpen: boolean;
  contextMenu: { x: number; y: number; nodeId?: string } | null;
  fileModalPath: string | null;

  // Toasts
  toasts: ToastMessage[];

  // Bookmarks
  bookmarks: BookmarkItem[];

  // Navigation history
  navigationHistory: string[];
  historyIndex: number;

  // Breadcrumbs
  breadcrumbs: { label: string; path?: string }[];

  // First time
  showOnboarding: boolean;

  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  toggleSettings: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelWidth: (width: number) => void;
  openShortcutOverlay: () => void;
  closeShortcutOverlay: () => void;
  setContextMenu: (menu: { x: number; y: number; nodeId?: string } | null) => void;
  setFileModal: (path: string | null) => void;

  // Toasts
  addToast: (type: ToastMessage['type'], message: string) => void;
  removeToast: (id: string) => void;

  // Bookmarks
  loadBookmarks: () => Promise<void>;
  addBookmark: (projectId: string, label: string, state: any) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;

  // Navigation
  pushNavigation: (nodeId: string) => void;
  navigateBack: () => string | null;
  setBreadcrumbs: (crumbs: { label: string; path?: string }[]) => void;

  // Onboarding
  dismissOnboarding: () => void;

  // Close all
  closeAll: () => void;
}

let toastCounter = 0;

export const useUIStore = create<UIState>((set, get) => ({
  searchOpen: false,
  settingsOpen: false,
  detailPanelOpen: true,
  detailPanelWidth: 380,
  shortcutOverlayOpen: false,
  contextMenu: null,
  fileModalPath: null,
  toasts: [],
  bookmarks: [],
  navigationHistory: [],
  historyIndex: -1,
  breadcrumbs: [],
  showOnboarding: !localStorage.getItem('codegraph_onboarded'),

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  setDetailPanelWidth: (width) => set({ detailPanelWidth: Math.max(280, Math.min(600, width)) }),
  openShortcutOverlay: () => set({ shortcutOverlayOpen: true }),
  closeShortcutOverlay: () => set({ shortcutOverlayOpen: false }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setFileModal: (path) => set({ fileModalPath: path }),

  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id, type, message }], // max 3
    }));
    setTimeout(() => get().removeToast(id), 4000);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  loadBookmarks: async () => {
    try {
      const bookmarks = await api.getBookmarks();
      set({ bookmarks });
    } catch (e) {
      // Silently fail
    }
  },

  addBookmark: async (projectId, label, state) => {
    try {
      await api.createBookmark(projectId, label, state);
      await get().loadBookmarks();
    } catch (e: any) {
      get().addToast('error', e.message);
    }
  },

  removeBookmark: async (id) => {
    try {
      await api.deleteBookmark(id);
      set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) }));
    } catch (e: any) {
      get().addToast('error', e.message);
    }
  },

  pushNavigation: (nodeId) => {
    set((s) => {
      const history = [...s.navigationHistory.slice(0, s.historyIndex + 1), nodeId].slice(-20);
      return { navigationHistory: history, historyIndex: history.length - 1 };
    });
  },

  navigateBack: () => {
    const { navigationHistory, historyIndex } = get();
    if (historyIndex <= 0) return null;
    const newIndex = historyIndex - 1;
    set({ historyIndex: newIndex });
    return navigationHistory[newIndex];
  },

  setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),

  dismissOnboarding: () => {
    localStorage.setItem('codegraph_onboarded', 'true');
    set({ showOnboarding: false });
  },

  closeAll: () =>
    set({
      searchOpen: false,
      settingsOpen: false,
      shortcutOverlayOpen: false,
      contextMenu: null,
      fileModalPath: null,
    }),
}));
