import { useState, useEffect } from 'react';
import { GitBranch, ChevronDown } from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useGraphStore } from '../../store/graphStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';
import type { BranchInfo } from '../../types';

export function BranchDropdown() {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const { loadGraph } = useGraphStore();
  const { addToast } = useUIStore();

  const currentBranch = branches.find((b) => b.current)?.name || 'main';

  useEffect(() => {
    if (open && projectId) {
      api.getBranches(projectId).then((res) => {
        setBranches(res.branches);
      }).catch(() => {});
    }
  }, [open, projectId]);

  const handleSwitch = async (branch: string) => {
    if (!projectId) return;
    setLoading(true);
    try {
      const result = await api.switchBranch(projectId, branch);
      if (result.success) {
        addToast('success', `Switched to ${branch}`);
        loadGraph(projectId);
      }
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          fontSize: 12,
          color: colors.textSecondary,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
        }}
      >
        <GitBranch size={14} />
        {currentBranch}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: 200,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {branches.map((b) => (
            <button
              key={b.name}
              onClick={() => handleSwitch(b.name)}
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: 13,
                color: b.current ? colors.accent : colors.textPrimary,
                background: b.current ? 'rgba(74, 158, 255, 0.1)' : 'transparent',
              }}
            >
              {b.name} {b.current && '(current)'}
            </button>
          ))}
          {branches.length === 0 && (
            <div style={{ padding: 12, fontSize: 13, color: colors.textMuted }}>
              Not a git repository
            </div>
          )}
        </div>
      )}
    </div>
  );
}
