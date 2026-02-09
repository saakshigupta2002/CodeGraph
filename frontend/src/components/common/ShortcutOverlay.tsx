import { X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { colors } from '../../utils/colors';

const shortcuts = [
  { key: 'Cmd+K', desc: 'Open search' },
  { key: 'Escape', desc: 'Close panels, exit modes' },
  { key: 'Cmd+Z', desc: 'Navigation undo' },
  { key: 'F', desc: 'Fit graph to screen' },
  { key: '1-5', desc: 'Switch tabs (Classes/Functions/Variables/Tests/Imports)' },
  { key: '?', desc: 'Show this shortcut overlay' },
  { key: 'Delete', desc: 'Collapse selected node' },
];

export function ShortcutOverlay() {
  const { shortcutOverlayOpen, closeShortcutOverlay } = useUIStore();

  if (!shortcutOverlayOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={closeShortcutOverlay}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 400,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>Keyboard Shortcuts</span>
          <button onClick={closeShortcutOverlay} style={{ color: colors.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {shortcuts.map(({ key, desc }) => (
            <div
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <span style={{ fontSize: 13, color: colors.textSecondary }}>{desc}</span>
              <kbd
                style={{
                  padding: '2px 8px',
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 4,
                  fontSize: 12,
                  color: colors.textPrimary,
                }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
