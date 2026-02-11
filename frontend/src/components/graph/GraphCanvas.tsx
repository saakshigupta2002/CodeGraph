import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import { ZoomControls } from './ZoomControls';
import { ImpactSummaryBar } from '../impact/ImpactSummaryBar';
import { useGraphStore } from '../../store/graphStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigationHistory } from '../../hooks/useNavigationHistory';
import { colors } from '../../utils/colors';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { smoothstep: CustomEdge };

export function GraphCanvas() {
  const { flowNodes, flowEdges, impactMode, impactResult, flowTraceResult, clearFlowTrace, rawNodes, loading, truncated, totalNodeCount } = useGraphStore();
  const { setDetailPanelOpen, setContextMenu } = useUIStore();
  const { selectNode, setHoveredNode, analyzeImpact } = useGraphStore();
  const { navigateToNode } = useNavigationHistory();
  const { fitView } = useReactFlow();

  const isLargeGraph = flowNodes.length > 150;

  const fitToScreen = useCallback(() => {
    fitView({ padding: 0.1, duration: 300 });
  }, [fitView]);

  // Fit view when nodes change
  useEffect(() => {
    if (flowNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.1, duration: 500 }), 100);
    }
  }, [flowNodes.length, fitView]);

  // Keyboard shortcut for F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          fitToScreen();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fitToScreen]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (impactMode) {
        analyzeImpact([node.id]);
      } else {
        navigateToNode(node.id);
        setDetailPanelOpen(true);
      }
    },
    [navigateToNode, setDetailPanelOpen, impactMode, analyzeImpact]
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!isLargeGraph) setHoveredNode(node.id);
    },
    [setHoveredNode, isLargeGraph]
  );

  const onNodeMouseLeave = useCallback(() => {
    if (!isLargeGraph) setHoveredNode(null);
  }, [setHoveredNode, isLargeGraph]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    },
    [setContextMenu]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setDetailPanelOpen(false);
    setContextMenu(null);
  }, [selectNode, setDetailPanelOpen, setContextMenu]);

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      const clientX = 'clientX' in event ? event.clientX : 0;
      const clientY = 'clientY' in event ? event.clientY : 0;
      setContextMenu({ x: clientX, y: clientY });
    },
    [setContextMenu]
  );

  // Apply hover dimming — skip for large graphs to save memory
  const { hoveredNodeId } = useGraphStore();
  const displayNodes = useMemo(() => {
    if (!hoveredNodeId || isLargeGraph) return flowNodes;

    const connectedIds = new Set<string>();
    connectedIds.add(hoveredNodeId);
    flowEdges.forEach((e) => {
      if (e.source === hoveredNodeId) connectedIds.add(e.target);
      if (e.target === hoveredNodeId) connectedIds.add(e.source);
    });

    return flowNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        opacity: connectedIds.has(n.id) ? 1 : 0.25,
      },
    }));
  }, [flowNodes, flowEdges, hoveredNodeId, isLargeGraph]);

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.bg,
        }}
      >
        <div style={{ color: colors.textSecondary }}>Loading graph...</div>
      </div>
    );
  }

  if (flowNodes.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.bg,
        }}
      >
        <div style={{ color: colors.textSecondary, textAlign: 'center' }}>
          <div style={{ fontSize: 16, marginBottom: 8 }}>Select a file from the sidebar to visualize its relationships.</div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>Or upload a project to get started.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: colors.bg }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={colors.border} />
        {!isLargeGraph && (
          <MiniMap
            nodeColor={(n) => (n.data as Record<string, any>).borderColor || colors.textMuted}
            maskColor="rgba(13, 13, 13, 0.8)"
            style={{ width: 160, height: 100 }}
          />
        )}
      </ReactFlow>

      <ZoomControls onFitToScreen={fitToScreen} />

      {impactResult && <ImpactSummaryBar />}

      {/* Flow trace summary bar */}
      {flowTraceResult && (
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.surface,
            border: `1px solid ${colors.accent}`,
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            color: colors.accent,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>
            Tracing from <strong>{rawNodes.find((n) => n.id === flowTraceResult.origin)?.name ?? '...'}</strong>
            {' \u2014 '}{flowTraceResult.chain.length} downstream call{flowTraceResult.chain.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={clearFlowTrace}
            style={{ color: colors.textMuted, fontSize: 11, textDecoration: 'underline' }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Truncation warning */}
      {truncated && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: colors.surface,
            border: `1px solid ${colors.partial}`,
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            color: colors.partial,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          Showing {flowNodes.length} of {totalNodeCount} nodes. Select specific files in the sidebar to see more detail.
        </div>
      )}
    </div>
  );
}
