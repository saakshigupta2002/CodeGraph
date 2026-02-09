import { useEffect, useRef } from 'react';
import { Zap, Expand, Minimize2, Sparkles, Copy, ExternalLink, Maximize2, RotateCcw, Download } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useGraphStore } from '../../store/graphStore';
import { useNavigationHistory } from '../../hooks/useNavigationHistory';
import { colors } from '../../utils/colors';

export function ContextMenu() {
  const { contextMenu, setContextMenu, setFileModal } = useUIStore();
  const { analyzeImpact } = useGraphStore();
  const { navigateToNode } = useNavigationHistory();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [setContextMenu]);

  if (!contextMenu) return null;

  const { nodeId } = contextMenu;

  const nodeItems = nodeId ? [
    { icon: Zap, label: 'Analyze impact', action: () => analyzeImpact([nodeId]) },
    { icon: Expand, label: 'Expand connections', action: () => navigateToNode(nodeId) },
    { icon: Minimize2, label: 'Collapse node', action: () => {} },
    { icon: Sparkles, label: 'Generate explanation', action: () => { navigateToNode(nodeId); useUIStore.getState().setDetailPanelOpen(true); } },
    { icon: Copy, label: 'Copy name', action: () => { const node = useGraphStore.getState().rawNodes.find(n => n.id === nodeId); if (node) navigator.clipboard.writeText(node.name); } },
    { icon: ExternalLink, label: 'Open file', action: () => { const node = useGraphStore.getState().rawNodes.find(n => n.id === nodeId); if (node) setFileModal(node.file_path); } },
  ] : [
    { icon: Maximize2, label: 'Fit to screen', action: () => {} },
    { icon: RotateCcw, label: 'Reset view', action: () => {} },
    { icon: Download, label: 'Export graph', action: () => {} },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: contextMenu.x,
        top: contextMenu.y,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 100,
        minWidth: 180,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {nodeItems.map(({ icon: Icon, label, action }) => (
        <button
          key={label}
          onClick={() => { action(); setContextMenu(null); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            width: '100%',
            textAlign: 'left',
            fontSize: 13,
            color: colors.textPrimary,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Icon size={14} color={colors.textSecondary} />
          {label}
        </button>
      ))}
    </div>
  );
}
