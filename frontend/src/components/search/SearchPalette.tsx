import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader, Braces, Box, FileText, Variable } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useNavigationHistory } from '../../hooks/useNavigationHistory';
import { api } from '../../api/client';
import { colors, nodeTypeColors } from '../../utils/colors';
import type { GraphNode } from '../../types';

const typeIcons: Record<string, typeof Box> = {
  class: Box,
  function: Braces,
  file: FileText,
  variable: Variable,
};

export function SearchPalette() {
  const { searchOpen, closeSearch } = useUIStore();
  const projectId = useProjectStore((s) => s.currentProject?.id);
  const { navigateToNode } = useNavigationHistory();
  const { setDetailPanelOpen } = useUIStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<(GraphNode & { reason?: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultType, setResultType] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('codegraph_recent_searches') || '[]');
    } catch { return []; }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const doSearch = useCallback(async () => {
    if (!query.trim() || !projectId) return;
    setLoading(true);
    try {
      const res = await api.search(projectId, query.trim());
      setResults(res.results || []);
      setResultType(res.type);
      setSelectedIndex(0);

      // Save to recent
      const recent = [query.trim(), ...recentSearches.filter((r: string) => r !== query.trim())].slice(0, 5);
      localStorage.setItem('codegraph_recent_searches', JSON.stringify(recent));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [query, projectId, recentSearches]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) doSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const selectResult = (node: GraphNode) => {
    navigateToNode(node.id);
    setDetailPanelOpen(true);
    closeSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) selectResult(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  };

  if (!searchOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 80,
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeSearch(); }}
    >
      <div
        style={{
          width: 560,
          maxHeight: 480,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
          <Search size={18} color={colors.textMuted} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search functions, classes, files... or ask a question"
            style={{
              flex: 1,
              marginLeft: 8,
              background: 'transparent',
              border: 'none',
              fontSize: 14,
              color: colors.textPrimary,
              outline: 'none',
            }}
          />
          {loading && <Loader size={16} color={colors.textMuted} className="spin" />}
          <button onClick={closeSearch} style={{ marginLeft: 8, color: colors.textMuted }}>
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {results.length === 0 && !loading && query.length >= 2 && (
            <div style={{ padding: 16, color: colors.textMuted, textAlign: 'center', fontSize: 13 }}>
              No matches found. Try a broader term or switch tabs.
            </div>
          )}

          {results.length === 0 && !query && recentSearches.length > 0 && (
            <div style={{ padding: 8 }}>
              <div style={{ padding: '8px 12px', fontSize: 11, color: colors.textMuted }}>Recent searches</div>
              {recentSearches.map((s: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setQuery(s)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: 13,
                    color: colors.textSecondary,
                    borderRadius: 4,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {resultType === 'ai' && results.length > 0 && (
            <div style={{ padding: '6px 16px', fontSize: 11, color: colors.accent }}>
              AI-powered results
            </div>
          )}

          {results.map((node, i) => {
            const Icon = typeIcons[node.type] || FileText;
            return (
              <button
                key={node.id}
                onClick={() => selectResult(node)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 16px',
                  width: '100%',
                  textAlign: 'left',
                  background: i === selectedIndex ? colors.surfaceHover : 'transparent',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <Icon size={16} color={nodeTypeColors[node.type] || colors.textMuted} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, color: colors.textPrimary }}>{node.name}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    {node.type} · {node.file_path}
                    {node.reason && <span style={{ color: colors.textSecondary }}> — {node.reason}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '6px 16px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 12, fontSize: 11, color: colors.textMuted }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
