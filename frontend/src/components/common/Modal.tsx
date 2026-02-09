import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';

export function FileModal() {
  const { fileModalPath, setFileModal } = useUIStore();
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fileModalPath && projectId) {
      setLoading(true);
      api.getFileContent(projectId, fileModalPath).then((res) => {
        setContent(res.content);
        setLanguage(res.language || 'text');
      }).catch(() => {
        setContent('// Failed to load file');
      }).finally(() => setLoading(false));
    }
  }, [fileModalPath, projectId]);

  if (!fileModalPath) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={() => setFileModal(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '80%',
          maxWidth: 900,
          height: '80%',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: 13, color: colors.textSecondary }}>{fileModalPath}</span>
          <button onClick={() => setFileModal(null)} style={{ color: colors.textMuted }}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 16, color: colors.textMuted }}>Loading...</div>
          ) : (
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: 16, fontSize: 13, background: '#111', minHeight: '100%' }}
              showLineNumbers
              lineNumberStyle={{ color: colors.textMuted, fontSize: 12 }}
            >
              {content}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  );
}
