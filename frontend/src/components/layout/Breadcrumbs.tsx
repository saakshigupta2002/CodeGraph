import { ChevronRight } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useGraphStore } from '../../store/graphStore';
import { colors } from '../../utils/colors';

export function Breadcrumbs() {
  const breadcrumbs = useUIStore((s) => s.breadcrumbs);
  const projectName = useProjectStore((s) => s.currentProject?.name);
  const { clearSelection, selectNode } = useGraphStore();

  const crumbs = [
    { label: projectName || 'Project', action: () => clearSelection() },
    ...breadcrumbs.map((c) => ({
      label: c.label,
      action: c.path ? () => selectNode(c.path!) : undefined,
    })),
  ];

  if (crumbs.length <= 1) return null;

  return (
    <div
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 4,
        fontSize: 12,
        color: colors.textMuted,
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bg,
        flexShrink: 0,
      }}
    >
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <ChevronRight size={12} />}
          <button
            onClick={crumb.action}
            style={{
              color: i === crumbs.length - 1 ? colors.textPrimary : colors.textSecondary,
              fontSize: 12,
              cursor: crumb.action ? 'pointer' : 'default',
            }}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </div>
  );
}
