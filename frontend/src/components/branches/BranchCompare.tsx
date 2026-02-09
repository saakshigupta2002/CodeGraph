import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';

export function BranchCompare() {
  const [branchA, setBranchA] = useState('');
  const [branchB, setBranchB] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const { addToast } = useUIStore();

  const handleCompare = async () => {
    if (!projectId || !branchA || !branchB) return;
    setLoading(true);
    try {
      const res = await api.compareBranches(projectId, branchA, branchB);
      setResult(res);
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={branchA}
          onChange={(e) => setBranchA(e.target.value)}
          placeholder="Base branch"
          style={{ flex: 1 }}
        />
        <input
          value={branchB}
          onChange={(e) => setBranchB(e.target.value)}
          placeholder="Compare branch"
          style={{ flex: 1 }}
        />
        <button
          onClick={handleCompare}
          disabled={loading || !branchA || !branchB}
          style={{
            padding: '8px 16px',
            background: colors.accent,
            color: '#fff',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          Compare
        </button>
      </div>

      {result && (
        <div style={{ fontSize: 13 }}>
          <div style={{ marginBottom: 8, color: colors.textSecondary }}>{result.summary}</div>
          {result.added?.length > 0 && (
            <div style={{ color: colors.tested }}>+ {result.added.join(', ')}</div>
          )}
          {result.removed?.length > 0 && (
            <div style={{ color: colors.untested }}>- {result.removed.join(', ')}</div>
          )}
          {result.modified?.length > 0 && (
            <div style={{ color: colors.partial }}>~ {result.modified.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  );
}
