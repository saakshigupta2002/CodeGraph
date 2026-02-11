import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { colors } from '../../utils/colors';

function CustomEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 12,
  });

  const edgeType = (data as any)?.edgeType as string | undefined;
  const showLabels = (data as any)?.showLabels as boolean | undefined;
  const flowOrder = (data as any)?.flowOrder as number | undefined;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {/* Flow trace execution order badge */}
        {flowOrder != null && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: colors.accent,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              width: 20,
              height: 20,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {flowOrder}
          </div>
        )}
        {/* Edge type label (toggleable) */}
        {showLabels && edgeType && !flowOrder && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 9,
              background: colors.surface,
              padding: '1px 5px',
              borderRadius: 3,
              color: colors.textMuted,
              border: `1px solid ${colors.border}`,
              pointerEvents: 'none',
            }}
          >
            {edgeType}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(CustomEdge);
