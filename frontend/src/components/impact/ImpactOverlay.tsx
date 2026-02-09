// Impact overlay is handled via node coloring in graphStore.updateFlowElements
// This file provides the tooltip for dependency chains

import { colors } from '../../utils/colors';

interface Props {
  chain: string[];
  nodeName: string;
}

export function ImpactTooltip({ chain, nodeName }: Props) {
  if (!chain || chain.length === 0) return null;

  const chainText = [...chain, nodeName].join(' → ');

  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 11,
        color: colors.textSecondary,
        maxWidth: 300,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span style={{ color: colors.textMuted }}>Affected because: </span>
      {chainText}
    </div>
  );
}
