import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useNavigationHistory } from '../../hooks/useNavigationHistory';
import { colors } from '../../utils/colors';
import type { ConnectionItem } from '../../types';

const edgeTypeColor: Record<string, string> = {
  calls: colors.nodeFunction,
  inherits: colors.nodeClass,
  imports: colors.nodeImport,
  reads: colors.edgeRead,
  writes: colors.edgeWrite,
};

interface Props {
  calls: ConnectionItem[];
  calledBy: ConnectionItem[];
}

export function Connections({ calls, calledBy }: Props) {
  const { navigateToNode } = useNavigationHistory();

  return (
    <div>
      <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
        CONNECTIONS
      </span>

      {calledBy.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
            Called by ({calledBy.length})
          </div>
          {calledBy.map((item) => (
            <ConnectionRow key={item.id} item={item} icon={<ArrowDownRight size={12} />} onClick={() => navigateToNode(item.id)} />
          ))}
        </div>
      )}

      {calls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
            Calls ({calls.length})
          </div>
          {calls.map((item, index) => (
            <ConnectionRow key={item.id} item={item} index={index + 1} icon={<ArrowUpRight size={12} />} onClick={() => navigateToNode(item.id)} />
          ))}
        </div>
      )}

      {calls.length === 0 && calledBy.length === 0 && (
        <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
          No connections found.
        </div>
      )}
    </div>
  );
}

function ConnectionRow({
  item, icon, index, onClick,
}: {
  item: ConnectionItem; icon: React.ReactNode; index?: number; onClick: () => void;
}) {
  const location = item.file_path + (item.line_start ? `:${item.line_start}` : '');

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        width: '100%',
        fontSize: 12,
        color: colors.textPrimary,
        borderRadius: 4,
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceHover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {index != null && (
        <span style={{ fontSize: 10, color: colors.textMuted, width: 16, flexShrink: 0 }}>{index}.</span>
      )}
      <span style={{ color: colors.textMuted, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.name}
      </span>
      <span style={{
        fontSize: 9,
        color: edgeTypeColor[item.type] || colors.textMuted,
        flexShrink: 0,
        padding: '1px 4px',
        borderRadius: 3,
        background: `${edgeTypeColor[item.type] || colors.textMuted}15`,
      }}>
        {item.type}
      </span>
      <span style={{ fontSize: 10, color: colors.textMuted, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {location}
      </span>
    </button>
  );
}
