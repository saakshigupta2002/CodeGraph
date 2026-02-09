import { useState } from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useGraphStore } from '../../store/graphStore';
import { useUIStore } from '../../store/uiStore';
import { CodeSnippet } from './CodeSnippet';
import { AIExplanation } from './AIExplanation';
import { Connections } from './Connections';
import { TestStatus } from './TestStatus';
import { colors, nodeTypeColors } from '../../utils/colors';

export function DetailPanel() {
  const { nodeDetail, selectedNodeId } = useGraphStore();
  const { detailPanelOpen, detailPanelWidth, setDetailPanelOpen, setDetailPanelWidth } = useUIStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!detailPanelOpen || !selectedNodeId) return null;

  const toggleSection = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isLoading = !nodeDetail;

  return (
    <div
      style={{
        width: detailPanelWidth,
        height: '100%',
        borderLeft: `1px solid ${colors.border}`,
        background: colors.surface,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Resize handle */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = detailPanelWidth;
          const onMove = (ev: MouseEvent) => {
            setDetailPanelWidth(startWidth - (ev.clientX - startX));
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {nodeDetail?.node.name || 'Loading...'}
          </div>
          {nodeDetail && (
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
              <span
                style={{
                  color: nodeTypeColors[nodeDetail.node.type] || colors.textSecondary,
                }}
              >
                {nodeDetail.node.type}
              </span>
              {' · '}
              {nodeDetail.node.file_path}
              {nodeDetail.node.line_start && `:${nodeDetail.node.line_start}`}
            </div>
          )}
        </div>
        <button onClick={() => setDetailPanelOpen(false)} style={{ color: colors.textMuted, padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isLoading ? (
          <div style={{ color: colors.textMuted }}>Loading details...</div>
        ) : (
          <>
            {/* Code Snippet */}
            <Section title="Code" collapsed={collapsed.code} onToggle={() => toggleSection('code')}>
              <CodeSnippet
                code={nodeDetail.code}
                language={nodeDetail.node.language}
                filePath={nodeDetail.node.file_path}
              />
            </Section>

            {/* AI Explanation */}
            <Section title="AI Explanation" collapsed={collapsed.ai} onToggle={() => toggleSection('ai')}>
              <AIExplanation
                nodeId={selectedNodeId}
                cachedExplanation={nodeDetail.ai_explanation}
              />
            </Section>

            {/* Connections */}
            <Section title="Connections" collapsed={collapsed.conn} onToggle={() => toggleSection('conn')}>
              <Connections calls={nodeDetail.calls} calledBy={nodeDetail.called_by} />
            </Section>

            {/* Test Status */}
            <Section title="Test Status" collapsed={collapsed.tests} onToggle={() => toggleSection('tests')}>
              <TestStatus testStatus={nodeDetail.test_status} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title, collapsed, onToggle, children,
}: {
  title: string; collapsed?: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${colors.border}`, paddingBottom: 12 }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          textAlign: 'left',
          marginBottom: collapsed ? 0 : 8,
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        {title}
      </button>
      {!collapsed && children}
    </div>
  );
}
