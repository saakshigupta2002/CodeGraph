import { useState } from 'react';
import { Sparkles, Loader } from 'lucide-react';
import { api } from '../../api/client';
import { useProjectStore } from '../../store/projectStore';
import { colors } from '../../utils/colors';

interface Props {
  nodeId: string;
  cachedExplanation: string | null;
}

export function AIExplanation({ nodeId, cachedExplanation }: Props) {
  const [explanation, setExplanation] = useState(cachedExplanation || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const projectId = useProjectStore((s) => s.currentProject?.id);

  const generate = async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    setExplanation('');

    try {
      await api.explainNode(projectId, nodeId, (chunk) => {
        setExplanation((prev) => prev + chunk);
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
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
        <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
          AI EXPLANATION
        </span>
      </div>

      {explanation ? (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: colors.textPrimary,
            whiteSpace: 'pre-wrap',
          }}
        >
          {explanation}
        </div>
      ) : error ? (
        <div style={{ fontSize: 13, color: colors.untested }}>{error}</div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 13,
            color: colors.accent,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            background: 'transparent',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <Loader size={14} className="spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {loading ? 'Generating...' : 'Generate explanation'}
        </button>
      )}
    </div>
  );
}
