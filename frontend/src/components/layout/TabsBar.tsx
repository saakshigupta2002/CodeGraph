import { useGraphStore } from '../../store/graphStore';
import { colors } from '../../utils/colors';
import type { TabType } from '../../types';

const tabs: { key: TabType | null; label: string; shortcut: string }[] = [
  { key: null, label: 'All', shortcut: '' },
  { key: 'classes', label: 'Classes', shortcut: '1' },
  { key: 'functions', label: 'Functions', shortcut: '2' },
  { key: 'variables', label: 'Variables', shortcut: '3' },
  { key: 'tests', label: 'Tests', shortcut: '4' },
  { key: 'imports', label: 'Imports', shortcut: '5' },
];

export function TabsBar() {
  const { activeTab, setActiveTab } = useGraphStore();

  return (
    <div
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bg,
        gap: 0,
        flexShrink: 0,
      }}
    >
      {tabs.map(({ key, label, shortcut }) => {
        const active = activeTab === key;
        return (
          <button
            key={label}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '6px 16px',
              fontSize: 13,
              color: active ? colors.textPrimary : colors.textSecondary,
              borderBottom: `2px solid ${active ? colors.accent : 'transparent'}`,
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {label}
            {shortcut && (
              <span
                style={{
                  fontSize: 10,
                  color: colors.textMuted,
                  marginLeft: 4,
                }}
              >
                {shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
