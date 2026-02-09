import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { GraphNode, GraphEdge, NodeDetail, ImpactResult, TabType, ZoomLevel } from '../types';
import { api } from '../api/client';
import { useProjectStore } from './projectStore';
import { getLayoutedElements } from '../utils/layout';
import { nodeTypeColors, colors } from '../utils/colors';

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

  // Loading
  loading: boolean;

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
  loading: false,

  loadGraph: async (projectId, tab) => {
    set({ loading: true });
    try {
      const data = await api.getGraph(projectId, tab ?? undefined);
      set({ rawNodes: data.nodes, rawEdges: data.edges, activeTab: tab ?? null });
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

    const { useProjectStore } = await import('./projectStore');
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
    // We handle visual dimming in the component via flowNodes update
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
    set({ selectedFiles: [filePath] });
    get().updateFlowElements();
  },

  toggleFileSelection: (filePath) => {
    set((s) => {
      const files = s.selectedFiles.includes(filePath)
        ? s.selectedFiles.filter((f) => f !== filePath)
        : [...s.selectedFiles, filePath].slice(0, 5); // Max 5
      return { selectedFiles: files };
    });
    get().updateFlowElements();
  },

  clearSelection: () => {
    set({ selectedFiles: [], selectedNodeId: null, nodeDetail: null });
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
    const { useProjectStore } = await import('./projectStore');
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

  updateFlowElements: () => {
    const { rawNodes, rawEdges, zoomLevel, selectedFiles, impactResult, impactNodeIds } = get();

    // Filter by zoom level
    let filteredNodes = rawNodes;
    if (zoomLevel === 'modules') {
      filteredNodes = rawNodes.filter((n) => n.type === 'file');
    } else if (zoomLevel === 'files') {
      filteredNodes = rawNodes.filter((n) => n.type === 'file' || n.type === 'class');
    }

    // Filter by selected files
    if (selectedFiles.length > 0) {
      const fileSet = new Set(selectedFiles);
      filteredNodes = filteredNodes.filter(
        (n) => fileSet.has(n.file_path) || n.type === 'file' && fileSet.has(n.file_path)
      );
    }

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    // Build impact sets for coloring
    const selectedSet = new Set(impactNodeIds);
    const directSet = new Set(impactResult?.directly_affected.map((n) => n.id) || []);
    const indirectSet = new Set(impactResult?.indirectly_affected.map((n) => n.id) || []);

    // Convert to React Flow nodes
    const flowNodes: Node[] = filteredNodes.map((n) => {
      let borderColor = nodeTypeColors[n.type] || colors.border;
      let opacity = 1;

      if (impactResult) {
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
        },
      };
    });

    // Convert to React Flow edges
    const flowEdges: Edge[] = rawEdges
      .filter((e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id))
      .map((e) => {
        let strokeColor: string = colors.edgeDefault;
        let strokeWidth = 1.5;

        if (e.type === 'calls') strokeWidth = 2;
        if (e.type === 'inherits') strokeColor = colors.nodeClass;
        if (e.type === 'imports') strokeColor = colors.nodeImport;
        if (e.metadata?.is_external) strokeColor = colors.textMuted;

        // Variable tab: read/write coloring
        if (e.type === 'reads') strokeColor = colors.edgeRead;
        if (e.type === 'writes') strokeColor = colors.edgeWrite;

        return {
          id: `e-${e.source_id}-${e.target_id}`,
          source: e.source_id,
          target: e.target_id,
          type: 'smoothstep',
          animated: e.type === 'calls',
          style: { stroke: strokeColor as string, strokeWidth },
          markerEnd: { type: 'arrowclosed' as const, color: strokeColor as string },
          data: { edgeType: e.type },
        };
      });

    // Apply layout
    const layouted = getLayoutedElements(flowNodes, flowEdges);
    set({ flowNodes: layouted.nodes, flowEdges: layouted.edges });
  },
}));
