import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { GraphNode, GraphEdge, NodeDetail, ImpactResult, FlowTraceResult, TabType, ZoomLevel } from '../types';
import { api } from '../api/client';
import { useProjectStore } from './projectStore';
import { useUIStore } from './uiStore';
import { getLayoutedElements } from '../utils/layout';
import { nodeTypeColors, colors } from '../utils/colors';
import { isTestFile } from '../utils/helpers';

// Performance limits
const MAX_RENDERED_NODES = 300;
const MAX_RENDERED_EDGES = 500;

interface GraphState {
  // Raw data from backend
  rawNodes: GraphNode[];
  rawEdges: GraphEdge[];

  // React Flow formatted
  flowNodes: Node[];
  flowEdges: Edge[];

  // UI state
  activeTab: TabType | null;
  selectedNodeId: string | null;
  nodeDetail: NodeDetail | null;
  hoveredNodeId: string | null;
  zoomLevel: ZoomLevel;
  selectedFiles: string[];

  // Impact
  impactMode: boolean;
  impactResult: ImpactResult | null;
  impactNodeIds: string[];

  // Flow trace
  flowTraceResult: FlowTraceResult | null;

  // Loading & limits
  loading: boolean;
  truncated: boolean;
  totalNodeCount: number;

  // Actions
  loadGraph: (projectId: string, tab?: TabType | null) => Promise<void>;
  selectNode: (nodeId: string | null) => Promise<void>;
  setHoveredNode: (nodeId: string | null) => void;
  setActiveTab: (tab: TabType | null) => void;
  setZoomLevel: (level: ZoomLevel) => void;
  selectFile: (filePath: string) => void;
  toggleFileSelection: (filePath: string) => void;
  clearSelection: () => void;

  // Impact
  toggleImpactMode: () => void;
  analyzeImpact: (nodeIds: string[]) => Promise<void>;
  clearImpact: () => void;

  // Flow trace
  traceFlow: (nodeId: string) => void;
  clearFlowTrace: () => void;

  // Layout
  updateFlowElements: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  rawNodes: [],
  rawEdges: [],
  flowNodes: [],
  flowEdges: [],
  activeTab: null,
  selectedNodeId: null,
  nodeDetail: null,
  hoveredNodeId: null,
  zoomLevel: 'functions',
  selectedFiles: [],
  impactMode: false,
  impactResult: null,
  impactNodeIds: [],
  flowTraceResult: null,
  loading: false,
  truncated: false,
  totalNodeCount: 0,

  loadGraph: async (projectId, tab) => {
    set({ loading: true });
    try {
      const data = await api.getGraph(projectId, tab ?? undefined);
      const totalNodeCount = data.nodes.length;

      // For very large projects with no file filter, auto-switch to modules zoom
      let autoZoom = get().zoomLevel;
      if (totalNodeCount > MAX_RENDERED_NODES && get().selectedFiles.length === 0) {
        autoZoom = 'modules';
      }

      set({
        rawNodes: data.nodes,
        rawEdges: data.edges,
        activeTab: tab ?? null,
        totalNodeCount,
        zoomLevel: autoZoom,
      });
      get().updateFlowElements();
    } catch (e) {
      console.error('Failed to load graph:', e);
    } finally {
      set({ loading: false });
    }
  },

  selectNode: async (nodeId) => {
    set({ selectedNodeId: nodeId, nodeDetail: null });
    if (!nodeId) return;

    const projectId = useProjectStore.getState().currentProject?.id;
    if (!projectId) return;

    try {
      const detail = await api.getNodeDetail(projectId, nodeId);
      set({ nodeDetail: detail });
    } catch (e) {
      console.error('Failed to load node detail:', e);
    }
  },

  setHoveredNode: (nodeId) => {
    set({ hoveredNodeId: nodeId });
  },

  setActiveTab: (tab) => {
    const projectId = useProjectStore.getState().currentProject?.id;
    if (projectId) {
      get().loadGraph(projectId, tab);
    }
  },

  setZoomLevel: (level) => {
    set({ zoomLevel: level });
    get().updateFlowElements();
  },

  selectFile: (filePath) => {
    // Switch to functions zoom when selecting a file so we see its contents
    set({ selectedFiles: [filePath], zoomLevel: 'functions' });
    get().updateFlowElements();
  },

  toggleFileSelection: (filePath) => {
    set((s) => {
      const files = s.selectedFiles.includes(filePath)
        ? s.selectedFiles.filter((f) => f !== filePath)
        : [...s.selectedFiles, filePath].slice(0, 5); // Max 5
      return { selectedFiles: files, zoomLevel: 'functions' };
    });
    get().updateFlowElements();
  },

  clearSelection: () => {
    // Revert to modules zoom if project is large
    const totalNodeCount = get().totalNodeCount;
    const autoZoom = totalNodeCount > MAX_RENDERED_NODES ? 'modules' : 'functions';
    set({ selectedFiles: [], selectedNodeId: null, nodeDetail: null, zoomLevel: autoZoom });
    get().updateFlowElements();
  },

  toggleImpactMode: () => {
    set((s) => ({
      impactMode: !s.impactMode,
      impactResult: s.impactMode ? null : s.impactResult,
      impactNodeIds: s.impactMode ? [] : s.impactNodeIds,
    }));
  },

  analyzeImpact: async (nodeIds) => {
    const projectId = useProjectStore.getState().currentProject?.id;
    if (!projectId) return;

    try {
      const result = await api.analyzeImpact(projectId, nodeIds);
      set({ impactResult: result, impactNodeIds: nodeIds });
      get().updateFlowElements();
    } catch (e) {
      console.error('Failed to analyze impact:', e);
    }
  },

  clearImpact: () => {
    set({ impactResult: null, impactNodeIds: [], impactMode: false });
    get().updateFlowElements();
  },

  traceFlow: (nodeId) => {
    const { rawEdges } = get();
    // Build forward adjacency from call edges only
    const adj = new Map<string, { targetId: string; edgeId: string }[]>();
    for (const e of rawEdges) {
      if (e.type !== 'calls') continue;
      const edgeId = `e-${e.source_id}-${e.target_id}`;
      if (!adj.has(e.source_id)) adj.set(e.source_id, []);
      adj.get(e.source_id)!.push({ targetId: e.target_id, edgeId });
    }

    // BFS from the clicked node
    const chain: { nodeId: string; depth: number; order: number; parentEdgeId: string }[] = [];
    const edgeOrder = new Map<string, number>();
    const visited = new Set<string>([nodeId]);
    const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }];
    let order = 0;

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const { targetId, edgeId } of adj.get(current.id) || []) {
        if (!visited.has(targetId)) {
          visited.add(targetId);
          order++;
          chain.push({ nodeId: targetId, depth: current.depth + 1, order, parentEdgeId: edgeId });
          edgeOrder.set(edgeId, order);
          queue.push({ id: targetId, depth: current.depth + 1 });
        }
      }
    }

    set({ flowTraceResult: { origin: nodeId, chain, edgeOrder } });
    get().updateFlowElements();
  },

  clearFlowTrace: () => {
    set({ flowTraceResult: null });
    get().updateFlowElements();
  },

  updateFlowElements: () => {
    const { rawNodes, rawEdges, zoomLevel, selectedFiles, impactResult, impactNodeIds, flowTraceResult } = get();

    // Filter by zoom level
    let filteredNodes = rawNodes;
    if (zoomLevel === 'modules') {
      filteredNodes = rawNodes.filter((n) => n.type === 'file');
    } else if (zoomLevel === 'files') {
      filteredNodes = rawNodes.filter((n) => n.type === 'file' || n.type === 'class');
    }

    // Filter by selected files (handle both absolute and relative paths)
    if (selectedFiles.length > 0) {
      const fileSet = new Set(selectedFiles);
      filteredNodes = filteredNodes.filter((n) => {
        if (fileSet.has(n.file_path)) return true;
        // Fallback: check if node path ends with any selected file path
        return selectedFiles.some((f) => n.file_path.endsWith('/' + f) || n.file_path.endsWith('/' + f.replace(/^\//, '')));
      });
    }

    // Enforce node limit to prevent memory exhaustion
    let truncated = false;
    if (filteredNodes.length > MAX_RENDERED_NODES) {
      truncated = true;
      // Prioritize: selected files' nodes first, then by type (classes > functions > rest)
      const typePriority: Record<string, number> = { class: 0, file: 1, function: 2, variable: 3, import: 4, module: 5 };
      filteredNodes = [...filteredNodes]
        .sort((a, b) => (typePriority[a.type] ?? 9) - (typePriority[b.type] ?? 9))
        .slice(0, MAX_RENDERED_NODES);
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const isLargeGraph = filteredNodes.length > 150;

    // Compute per-node connection counts from all visible edges
    const visibleEdges = rawEdges.filter((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));
    const incomingCount = new Map<string, number>();
    const outgoingCount = new Map<string, number>();
    for (const e of visibleEdges) {
      incomingCount.set(e.target_id, (incomingCount.get(e.target_id) || 0) + 1);
      outgoingCount.set(e.source_id, (outgoingCount.get(e.source_id) || 0) + 1);
    }

    // Compute test coverage: find nodes called by test files
    const testNodeIds = new Set(rawNodes.filter((n) => isTestFile(n.file_path)).map((n) => n.id));
    const testedNodeIds = new Set<string>();
    for (const e of rawEdges) {
      if (e.type === 'calls' && testNodeIds.has(e.source_id)) {
        testedNodeIds.add(e.target_id);
      }
    }

    // Detect entry points: high fan-out, low fan-in
    const entryPointIds = new Set<string>();
    for (const n of filteredNodes) {
      if (n.type !== 'function') continue;
      const inCount = incomingCount.get(n.id) || 0;
      const outCount = outgoingCount.get(n.id) || 0;
      if (outCount >= 3 && inCount <= 1) entryPointIds.add(n.id);
    }

    // Build impact sets for coloring
    const selectedSet = new Set(impactNodeIds);
    const directSet = new Set(impactResult?.directly_affected.map((n) => n.id) || []);
    const indirectSet = new Set(impactResult?.indirectly_affected.map((n) => n.id) || []);

    // Build flow trace sets for coloring
    const flowTraceNodeIds = flowTraceResult
      ? new Set([flowTraceResult.origin, ...flowTraceResult.chain.map((s) => s.nodeId)])
      : null;

    // Convert to React Flow nodes
    const flowNodes: Node[] = filteredNodes.map((n) => {
      let borderColor = nodeTypeColors[n.type] || colors.border;
      let opacity = 1;

      if (flowTraceNodeIds) {
        if (n.id === flowTraceResult!.origin) {
          borderColor = colors.accent;
        } else if (flowTraceNodeIds.has(n.id)) {
          borderColor = colors.tested;
        } else {
          opacity = 0.15;
          borderColor = colors.impactDimmed;
        }
      } else if (impactResult) {
        if (selectedSet.has(n.id)) {
          borderColor = colors.impactSelected;
        } else if (directSet.has(n.id)) {
          borderColor = colors.impactDirect;
        } else if (indirectSet.has(n.id)) {
          borderColor = colors.impactIndirect;
        } else {
          opacity = 0.3;
          borderColor = colors.impactDimmed;
        }
      }

      const isEntryPoint = entryPointIds.has(n.id);

      return {
        id: n.id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          label: n.name,
          nodeType: n.type,
          language: n.language,
          filePath: n.file_path,
          metadata: n.metadata,
          borderColor,
          opacity,
          incomingCount: incomingCount.get(n.id) || 0,
          outgoingCount: outgoingCount.get(n.id) || 0,
          testCovered: (n.type === 'function' || n.type === 'class') ? testedNodeIds.has(n.id) : null,
          isEntryPoint,
        },
      };
    });

    // Convert to React Flow edges — cap count for performance
    let filteredEdges = rawEdges.filter((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id));
    if (filteredEdges.length > MAX_RENDERED_EDGES) {
      // Prioritize calls and inherits edges
      const edgePriority: Record<string, number> = { calls: 0, inherits: 1, imports: 2, composes: 3, reads: 4, writes: 5, tests: 6 };
      filteredEdges = [...filteredEdges]
        .sort((a, b) => (edgePriority[a.type] ?? 9) - (edgePriority[b.type] ?? 9))
        .slice(0, MAX_RENDERED_EDGES);
    }

    const showEdgeLabels = useUIStore.getState().showEdgeLabels;

    const flowEdges: Edge[] = filteredEdges.map((e) => {
      let strokeColor: string = colors.edgeDefault;
      let strokeWidth = 1.5;
      let strokeDasharray: string | undefined = undefined;

      if (e.type === 'calls') strokeWidth = 2;
      if (e.type === 'inherits') { strokeColor = colors.nodeClass; strokeDasharray = '8 4'; }
      if (e.type === 'imports') { strokeColor = colors.nodeImport; strokeDasharray = '3 3'; }
      if (e.type === 'reads') { strokeColor = colors.edgeRead; strokeDasharray = '6 3 2 3'; }
      if (e.type === 'writes') strokeColor = colors.edgeWrite;
      if (e.metadata?.is_external) strokeColor = colors.textMuted;

      const markerEnd = e.type === 'inherits'
        ? { type: 'arrow' as const, color: strokeColor as string, width: 20, height: 20 }
        : { type: 'arrowclosed' as const, color: strokeColor as string };

      const edgeId = `e-${e.source_id}-${e.target_id}`;
      let animated = !isLargeGraph && e.type === 'calls';
      let flowOrder: number | undefined = undefined;

      // Flow trace edge highlighting
      if (flowTraceResult) {
        const traceOrder = flowTraceResult.edgeOrder.get(edgeId);
        if (traceOrder != null) {
          strokeColor = colors.accent;
          strokeWidth = 2.5;
          strokeDasharray = undefined;
          animated = true;
          flowOrder = traceOrder;
        } else {
          strokeColor = colors.impactDimmed;
          strokeWidth = 1;
          strokeDasharray = undefined;
        }
      }

      return {
        id: edgeId,
        source: e.source_id,
        target: e.target_id,
        type: 'smoothstep',
        animated,
        style: { stroke: strokeColor as string, strokeWidth, strokeDasharray },
        markerEnd: flowTraceResult && !flowTraceResult.edgeOrder.has(edgeId)
          ? { type: 'arrowclosed' as const, color: colors.impactDimmed }
          : markerEnd,
        data: { edgeType: e.type, showLabels: showEdgeLabels, flowOrder },
      };
    });

    // Apply layout
    const layouted = getLayoutedElements(flowNodes, flowEdges);
    set({ flowNodes: layouted.nodes, flowEdges: layouted.edges, truncated });
  },
}));
