// API client for CodeGraph backend
const API_BASE = 'http://localhost:8000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'Request failed');
  }
  return res.json();
}

// Project endpoints
export const api = {
  // Projects
  uploadProject: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/project/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error((await res.json()).detail);
    return res.json();
  },

  importGithub: (url: string, pat?: string) =>
    request('/project/github', {
      method: 'POST',
      body: JSON.stringify({ url, pat: pat || null }),
    }),

  listProjects: () => request<any[]>('/projects'),

  // Graph
  getGraph: (projectId: string, tab?: string) =>
    request<{ nodes: any[]; edges: any[] }>(
      `/project/${projectId}/graph${tab ? `?tab=${tab}` : ''}`
    ),

  getFileTree: (projectId: string) =>
    request<any>(`/project/${projectId}/file-tree`),

  getNodeDetail: (projectId: string, nodeId: string) =>
    request<any>(`/project/${projectId}/node/${nodeId}`),

  getStats: (projectId: string) =>
    request<any>(`/project/${projectId}/stats`),

  getFileContent: (projectId: string, filePath: string) =>
    request<any>(`/project/${projectId}/file/${filePath}`),

  // AI - Streaming
  explainNode: async (projectId: string, nodeId: string, onChunk: (text: string) => void) => {
    const res = await fetch(`${API_BASE}/project/${projectId}/node/${nodeId}/explain`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error((await res.json()).detail);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value));
    }
  },

  // Search
  search: (projectId: string, query: string) =>
    request<any>(`/project/${projectId}/search`, {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  // Impact
  analyzeImpact: (projectId: string, nodeIds: string[]) =>
    request<any>(`/project/${projectId}/impact`, {
      method: 'POST',
      body: JSON.stringify({ node_ids: nodeIds }),
    }),

  // Sync & Branches
  syncProject: (projectId: string) =>
    request<any>(`/project/${projectId}/sync`, { method: 'POST' }),

  getBranches: (projectId: string) =>
    request<{ branches: any[] }>(`/project/${projectId}/branches`),

  switchBranch: (projectId: string, branch: string) =>
    request<any>(`/project/${projectId}/branch/switch`, {
      method: 'POST',
      body: JSON.stringify({ branch }),
    }),

  compareBranches: (projectId: string, branchA: string, branchB: string) =>
    request<any>(`/project/${projectId}/branch/compare`, {
      method: 'POST',
      body: JSON.stringify({ branch_a: branchA, branch_b: branchB }),
    }),

  // File analysis
  analyzeFile: (projectId: string, filePath: string) =>
    request<any>(`/project/${projectId}/analyze-file`, {
      method: 'POST',
      body: JSON.stringify({ file_path: filePath }),
    }),

  // Settings
  getSettings: () => request<any>('/settings'),
  updateSettings: (settings: any) =>
    request<any>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  setApiKey: (apiKey: string) =>
    request<any>('/settings/api-key', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    }),

  // Bookmarks
  getBookmarks: () => request<any[]>('/bookmarks'),
  createBookmark: (projectId: string, label: string, state: any) =>
    request<any>('/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, label, state }),
    }),
  deleteBookmark: (id: string) =>
    request<any>(`/bookmarks/${id}`, { method: 'DELETE' }),

  // Export
  exportGraph: (projectId: string) =>
    request<any>(`/export/${projectId}`),
};
