import { useProjectStore } from '../../store/projectStore';
import { useGraphStore } from '../../store/graphStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';

export function exportGraphAsJSON(projectId: string) {
  api.exportGraph(projectId).then((data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codegraph-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export function exportGraphAsPNG() {
  const canvas = document.querySelector('.react-flow__viewport') as HTMLElement;
  if (!canvas) return;

  // Use html2canvas-like approach via SVG serialization
  import('html-to-image' as any).then((mod: any) => {
    mod.toPng(canvas).then((dataUrl: string) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'codegraph.png';
      a.click();
    });
  }).catch(() => {
    // Fallback: just notify
    useUIStore.getState().addToast('info', 'PNG export requires html-to-image package');
  });
}

export function generateShareableURL() {
  const { currentProject } = useProjectStore.getState();
  const { activeTab, selectedNodeId, selectedFiles } = useGraphStore.getState();

  if (!currentProject) return '';

  const params = new URLSearchParams();
  params.set('project', currentProject.id);
  if (activeTab) params.set('tab', activeTab);
  if (selectedNodeId) params.set('node', selectedNodeId);
  if (selectedFiles.length) params.set('files', selectedFiles.join(','));

  return `${window.location.origin}?${params.toString()}`;
}

export function copyShareableURL() {
  const url = generateShareableURL();
  navigator.clipboard.writeText(url);
  useUIStore.getState().addToast('success', 'Shareable URL copied to clipboard');
}
