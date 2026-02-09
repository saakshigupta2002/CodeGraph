import { useGraphStore } from '../../store/graphStore';
import { colors } from '../../utils/colors';

export function ImpactSummaryBar() {
  const { impactResult, clearImpact } = useGraphStore();

  if (!impactResult) return null;

  const { summary } = impactResult;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontSize: 13,
        zIndex: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      <span style={{ color: colors.impactDirect, fontWeight: 600 }}>
        {summary.directly_affected} directly affected
      </span>
      <span style={{ color: colors.border }}>·</span>
      <span style={{ color: colors.impactIndirect, fontWeight: 600 }}>
        {summary.indirectly_affected} indirectly affected
      </span>
      <span style={{ color: colors.border }}>·</span>
      <span style={{ color: colors.partial, fontWeight: 600 }}>
        {summary.tests_needing_update} tests need updating
      </span>

      <button
        onClick={clearImpact}
        style={{
          marginLeft: 8,
          padding: '4px 10px',
          fontSize: 11,
          color: colors.textMuted,
          border: `1px solid ${colors.border}`,
          borderRadius: 4,
        }}
      >
        Clear
      </button>
    </div>
  );
}
