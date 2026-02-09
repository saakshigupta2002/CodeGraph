import { useEffect, Suspense, lazy, Component, type ReactNode } from 'react';
import { useProjectStore } from './store/projectStore';
import { useSettingsStore } from './store/settingsStore';
import './styles/globals.css';

// Lazy-loaded components — prevents heavy import trees from blocking initial render
const LandingPageLazy = lazy(() => import('./components/onboarding/LandingPage').then(m => ({ default: m.LandingPage })));
const MainLayoutLazy = lazy(() => import('./components/layout/MainLayout').then(m => ({ default: m.MainLayout })));
const ToastStackLazy = lazy(() => import('./components/common/Toast').then(m => ({ default: m.ToastStack })));

// Error boundary to catch and display render errors
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#EF4444', fontFamily: 'monospace', background: '#0D0D0D', minHeight: '100vh' }}>
          <h2 style={{ color: '#E0E0E0', marginBottom: 16 }}>CodeGraph Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#808080', marginTop: 12 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingFallback() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#808080', fontSize: 16 }}>Loading CodeGraph...</div>
    </div>
  );
}

function AppInner() {
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
          // Lazy import graphStore only when needed for URL params
          import('./store/graphStore').then(({ useGraphStore }) => {
            useGraphStore.getState().loadGraph(projectId, (tab as any) || undefined);
            if (node) useGraphStore.getState().selectNode(node);
            if (files) files.split(',').forEach((f) => useGraphStore.getState().selectFile(f));
          });
          useProjectStore.getState().loadFileTree();
          unsubscribe();
        }
      });
    }
  }, [loadProjects, loadSettings]);

  if (!currentProject) {
    return (
      <div style={{ height: '100%' }}>
        <LandingPageLazy />
        <ToastStackLazy />
      </div>
    );
  }

  return <MainLayoutLazy />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <AppInner />
      </Suspense>
    </ErrorBoundary>
  );
}
