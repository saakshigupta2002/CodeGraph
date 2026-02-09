import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ExternalLink } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { colors } from '../../utils/colors';

interface Props {
  code: string;
  language: string | null;
  filePath: string;
}

export function CodeSnippet({ code, language, filePath }: Props) {
  const setFileModal = useUIStore((s) => s.setFileModal);
  const langMap: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    java: 'java',
    go: 'go',
    rust: 'rust',
    c: 'c',
    cpp: 'cpp',
    ruby: 'ruby',
    php: 'php',
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>CODE</span>
        <button
          onClick={() => setFileModal(filePath)}
          style={{
            fontSize: 11,
            color: colors.accent,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          Open full file <ExternalLink size={11} />
        </button>
      </div>

      <div
        style={{
          borderRadius: 6,
          overflow: 'auto',
          maxHeight: 250,
          border: `1px solid ${colors.border}`,
        }}
      >
        <SyntaxHighlighter
          language={langMap[language || ''] || 'text'}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 12,
            fontSize: 12,
            background: '#111111',
            lineHeight: 1.5,
          }}
          showLineNumbers
          lineNumberStyle={{ color: colors.textMuted, fontSize: 11 }}
        >
          {code || '// No code available'}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
