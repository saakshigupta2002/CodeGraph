import { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';
import { useGraphStore } from '../store/graphStore';
import type { TabType } from '../types';

const tabs: TabType[] = ['classes', 'functions', 'variables', 'tests', 'imports'];

export function useKeyboardShortcuts() {
  const { openSearch, closeAll, openShortcutOverlay } = useUIStore();
  const { setActiveTab } = useGraphStore();
  const navigateBack = useUIStore((s) => s.navigateBack);
  const selectNode = useGraphStore((s) => s.selectNode);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd+K — search
      if (meta && e.key === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }

      // Escape — close everything
      if (e.key === 'Escape') {
        closeAll();
        return;
      }

      // Cmd+Z — navigation undo
      if (meta && e.key === 'z' && !e.shiftKey && !isInput) {
        e.preventDefault();
        const prev = navigateBack();
        if (prev) selectNode(prev);
        return;
      }

      if (isInput) return;

      // F — fit to screen (handled by graph canvas)
      // 1-5 — switch tabs
      if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key) - 1;
        setActiveTab(tabs[idx]);
        return;
      }

      // ? — shortcut overlay
      if (e.key === '?') {
        openShortcutOverlay();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openSearch, closeAll, navigateBack, selectNode, setActiveTab, openShortcutOverlay]);
}
