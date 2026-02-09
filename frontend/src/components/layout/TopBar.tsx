import { useState } from 'react';
import { Search, Settings, Bookmark, Zap, RefreshCw } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useGraphStore } from '../../store/graphStore';
import { useUIStore } from '../../store/uiStore';
import { BranchDropdown } from '../branches/BranchDropdown';
import { BookmarkDropdown } from '../common/BookmarkDropdown';
import { colors } from '../../utils/colors';
import { api } from '../../api/client';

export function TopBar() {
  const { currentProject, stats } = useProjectStore();
  const { impactMode, toggleImpactMode } = useGraphStore();
  const { openSearch, toggleSettings, addToast } = useUIStore();
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const handleSync = async () => {
    if (!currentProject || syncing) return;
    setSyncing(true);
    try {
      const result = await api.syncProject(currentProject.id);
      addToast('success', result.summary);
      setLastSynced(new Date().toLocaleTimeString());
      // Reload graph
      useGraphStore.getState().loadGraph(currentProject.id);
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface,
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Left: Branch + Sync */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BranchDropdown />

        <button
          onClick={handleSync}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            fontSize: 12,
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
          }}
          disabled={syncing}
        >
          <RefreshCw size={14} className={syncing ? 'spin' : ''} />
          Sync
        </button>

        {lastSynced && (
          <span style={{ fontSize: 11, color: colors.textMuted }}>
            Last synced: {lastSynced}
          </span>
        )}
      </div>

      {/* Center: Stats */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        {stats && (
          <span style={{ fontSize: 12, color: colors.textSecondary }}>
            {stats.file_count} files · {stats.function_count} functions · {stats.class_count} classes · {stats.test_file_count} test files · {stats.coverage_percent}% coverage
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={openSearch}
          style={{ padding: 6, color: colors.textSecondary, borderRadius: 6 }}
          title="Search (Cmd+K)"
        >
          <Search size={18} />
        </button>

        <button
          onClick={toggleImpactMode}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            color: impactMode ? colors.impactDirect : colors.textSecondary,
            background: impactMode ? 'rgba(255, 107, 74, 0.15)' : 'transparent',
            border: `1px solid ${impactMode ? colors.impactDirect : colors.border}`,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title="Toggle impact analysis mode"
        >
          <Zap size={14} />
          Impact
        </button>

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowBookmarks(!showBookmarks)}
            style={{ padding: 6, color: colors.textSecondary, borderRadius: 6 }}
            title="Bookmarks"
          >
            <Bookmark size={18} />
          </button>
          {showBookmarks && <BookmarkDropdown />}
        </div>

        <button
          onClick={toggleSettings}
          style={{ padding: 6, color: colors.textSecondary, borderRadius: 6 }}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}
