import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useNavigationHistory } from '../../hooks/useNavigationHistory';
import { colors } from '../../utils/colors';
import type { ConnectionItem } from '../../types';

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
          {calls.map((item) => (
            <ConnectionRow key={item.id} item={item} icon={<ArrowUpRight size={12} />} onClick={() => navigateToNode(item.id)} />
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
  item, icon, onClick,
}: {
  item: ConnectionItem; icon: React.ReactNode; onClick: () => void;
}) {
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
      <span style={{ color: colors.textMuted }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.name}
      </span>
      <span style={{ fontSize: 10, color: colors.textMuted }}>{item.file_path}</span>
    </button>
  );
}
