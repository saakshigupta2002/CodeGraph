import { useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useSettingsStore } from './store/settingsStore';
import { MainLayout } from './components/layout/MainLayout';
import { LandingPage } from './components/onboarding/LandingPage';
import { useGraphStore } from './store/graphStore';
import { ToastStack } from './components/common/Toast';
import './styles/globals.css';

export default function App() {
  const { currentProject, loadProjects } = useProjectStore();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    loadProjects();
    loadSettings();

    // Parse URL params for shareable URLs
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    if (projectId) {
      const tab = params.get('tab');
      const node = params.get('node');
      const files = params.get('files');

      const unsubscribe = useProjectStore.subscribe((state) => {
        const project = state.projects.find((p) => p.id === projectId);
        if (project) {
          useProjectStore.getState().setCurrentProject(project);
          useGraphStore.getState().loadGraph(projectId, tab as any || undefined);
          if (node) {
            useGraphStore.getState().selectNode(node);
          }
          if (files) {
            files.split(',').forEach((f) => useGraphStore.getState().selectFile(f));
          }
          useProjectStore.getState().loadFileTree();
          unsubscribe();
        }
      });
    }
  }, [loadProjects, loadSettings]);

  if (!currentProject) {
    return (
      <div style={{ height: '100%' }}>
        <LandingPage />
        <ToastStack />
      </div>
    );
  }

  return <MainLayout />;
}
