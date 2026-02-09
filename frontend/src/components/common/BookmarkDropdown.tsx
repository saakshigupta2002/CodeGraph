import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useGraphStore } from '../../store/graphStore';
import { colors } from '../../utils/colors';

interface Props {}

export function BookmarkDropdown({}: Props) {
  const { bookmarks, loadBookmarks, addBookmark, removeBookmark } = useUIStore();
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const { activeTab, selectedNodeId, selectedFiles } = useGraphStore();
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleAdd = async () => {
    if (!projectId || !label.trim()) return;
    await addBookmark(projectId, label.trim(), {
      tab: activeTab,
      selectedNode: selectedNodeId,
      files: selectedFiles,
    });
    setLabel('');
    setAdding(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 280,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 50,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>Bookmarks</span>
        <button onClick={() => setAdding(!adding)} style={{ color: colors.accent }}>
          <Plus size={16} />
        </button>
      </div>

      {adding && (
        <div style={{ padding: 8, borderBottom: `1px solid ${colors.border}`, display: 'flex', gap: 4 }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bookmark label"
            style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button
            onClick={handleAdd}
            style={{ padding: '4px 8px', fontSize: 11, color: colors.accent, border: `1px solid ${colors.border}`, borderRadius: 4 }}
          >
            Save
          </button>
        </div>
      )}

      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {bookmarks.length === 0 && (
          <div style={{ padding: 12, fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
            No bookmarks yet
          </div>
        )}
        {bookmarks.map((b) => (
          <div
            key={b.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: `1px solid ${colors.border}`,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <span style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{b.label}</span>
            <button onClick={() => removeBookmark(b.id)} style={{ color: colors.textMuted, padding: 2 }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
