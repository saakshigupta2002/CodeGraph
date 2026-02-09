import { create } from 'zustand';
import type { FileTreeNode, ProjectInfo, ProjectStats } from '../types';
import { api } from '../api/client';

interface ProjectState {
  // Current project
  currentProject: ProjectInfo | null;
  projects: ProjectInfo[];
  fileTree: FileTreeNode | null;
  stats: ProjectStats | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadProjects: () => Promise<void>;
  setCurrentProject: (project: ProjectInfo) => void;
  loadFileTree: () => Promise<void>;
  loadStats: () => Promise<void>;
  uploadProject: (file: File) => Promise<ProjectInfo>;
  importGithub: (url: string, pat?: string) => Promise<ProjectInfo>;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projects: [],
  fileTree: null,
  stats: null,
  loading: false,
  error: null,

  loadProjects: async () => {
    try {
      const projects = await api.listProjects();
      set({ projects });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project, stats: project.stats ?? null });
  },

  loadFileTree: async () => {
    const { currentProject } = get();
    if (!currentProject) return;
    try {
      const tree = await api.getFileTree(currentProject.id);
      set({ fileTree: tree });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  loadStats: async () => {
    const { currentProject } = get();
    if (!currentProject) return;
    try {
      const stats = await api.getStats(currentProject.id);
      set({ stats });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  uploadProject: async (file) => {
    set({ loading: true, error: null });
    try {
      const project = await api.uploadProject(file);
      set((s) => ({
        currentProject: project,
        projects: [project, ...s.projects],
        stats: project.stats,
        loading: false,
      }));
      return project;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  importGithub: async (url, pat) => {
    set({ loading: true, error: null });
    try {
      const project = await api.importGithub(url, pat) as ProjectInfo;
      set((s) => ({
        currentProject: project,
        projects: [project, ...s.projects],
        stats: project.stats,
        loading: false,
      }));
      return project;
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));
