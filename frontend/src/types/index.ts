// Core data types matching backend API

export interface GraphNode {
  id: string;
  name: string;
  type: 'class' | 'function' | 'variable' | 'import' | 'file' | 'module';
  language: string | null;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  code_hash: string | null;
  parent_id: string | null;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: number;
  source_id: string;
  target_id: string;
  type: 'calls' | 'inherits' | 'imports' | 'composes' | 'reads' | 'writes' | 'tests';
  metadata: Record<string, unknown>;
}

export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  github_url: string | null;
  created_at: string;
  last_synced: string | null;
  stats: ProjectStats | null;
  warnings?: string[];
}

export interface ProjectStats {
  file_count: number;
  function_count: number;
  class_count: number;
  variable_count: number;
  import_count: number;
  test_file_count: number;
  coverage_percent: number;
  node_count: number;
  edge_count: number;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  language?: string | null;
  supported?: boolean;
  children?: FileTreeNode[];
  function_count?: number;
  class_count?: number;
}

export interface NodeDetail {
  node: GraphNode;
  code: string;
  calls: ConnectionItem[];
  called_by: ConnectionItem[];
  ai_explanation: string | null;
  test_status: TestStatus;
}

export interface ConnectionItem {
  id: string;
  name: string;
  type: string;
  file_path: string;
  line_start?: number | null;
}

export interface FlowTraceStep {
  nodeId: string;
  depth: number;
  order: number;
  parentEdgeId: string;
}

export interface FlowTraceResult {
  origin: string;
  chain: FlowTraceStep[];
  edgeOrder: Map<string, number>;
}

export interface TestStatus {
  status: 'covered' | 'uncovered' | 'partial';
  test_files: string[];
  coverage: string;
}

export interface ImpactResult {
  selected: GraphNode[];
  directly_affected: (GraphNode & { chain: string[] })[];
  indirectly_affected: (GraphNode & { chain: string[] })[];
  tests_needing_update: GraphNode[];
  summary: {
    directly_affected: number;
    indirectly_affected: number;
    tests_needing_update: number;
  };
}

export interface SearchResult {
  type: 'exact' | 'ai' | 'no_key' | 'error';
  results: (GraphNode & { reason?: string })[];
  message?: string;
}

export interface BranchInfo {
  name: string;
  current: boolean;
}

export interface BookmarkItem {
  id: string;
  project_id: string;
  label: string;
  state: BookmarkState;
  created_at: string;
}

export interface BookmarkState {
  file?: string;
  tab?: TabType;
  zoom?: number;
  selectedNode?: string;
  position?: { x: number; y: number };
}

export type TabType = 'classes' | 'functions' | 'variables' | 'tests' | 'imports';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface Settings {
  api_key_set: boolean;
  api_key_masked: string;
  ai_model: string;
  exclude_patterns: string[] | null;
  file_limit: number;
  language_filters: string[] | null;
  daily_limit: number;
  daily_usage: number;
}

export type ZoomLevel = 'modules' | 'files' | 'functions';
