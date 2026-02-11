import { Maximize2, Tag } from 'lucide-react';
import { useGraphStore } from '../../store/graphStore';
import { useUIStore } from '../../store/uiStore';
import { colors } from '../../utils/colors';
import type { ZoomLevel } from '../../types';

const levels: { key: ZoomLevel; label: string }[] = [
  { key: 'modules', label: 'Modules' },
  { key: 'files', label: 'Files' },
  { key: 'functions', label: 'Functions' },
];

interface Props {
  onFitToScreen: () => void;
}

export function ZoomControls({ onFitToScreen }: Props) {
  const { zoomLevel, setZoomLevel, updateFlowElements } = useGraphStore();
  const { showEdgeLabels, toggleEdgeLabels } = useUIStore();

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {levels.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setZoomLevel(key)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              color: zoomLevel === key ? colors.accent : colors.textSecondary,
              background: zoomLevel === key ? colors.surfaceHover : 'transparent',
              borderRight: `1px solid ${colors.border}`,
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        onClick={onFitToScreen}
        style={{
          padding: 6,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          color: colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
        }}
        title="Fit to screen (F)"
      >
        <Maximize2 size={16} />
      </button>

      <button
        onClick={() => { toggleEdgeLabels(); updateFlowElements(); }}
        style={{
          padding: 6,
          background: showEdgeLabels ? colors.surfaceHover : colors.surface,
          border: `1px solid ${showEdgeLabels ? colors.accent : colors.border}`,
          borderRadius: 8,
          color: showEdgeLabels ? colors.accent : colors.textSecondary,
          display: 'flex',
          alignItems: 'center',
        }}
        title="Toggle edge labels"
      >
        <Tag size={16} />
      </button>
    </div>
  );
}
