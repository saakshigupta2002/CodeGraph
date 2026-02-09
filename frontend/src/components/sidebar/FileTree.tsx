import { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, FileText, Folder, FolderOpen,
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { useGraphStore } from '../../store/graphStore';
import { colors, languageColors } from '../../utils/colors';
import type { FileTreeNode } from '../../types';

export function FileTree() {
  const { currentProject, fileTree, loadFileTree } = useProjectStore();
  const { selectFile, toggleFileSelection, selectedFiles } = useGraphStore();

  useEffect(() => {
    if (currentProject && !fileTree) {
      loadFileTree();
    }
  }, [currentProject, fileTree, loadFileTree]);

  if (!fileTree) {
    return (
      <div style={{ padding: 16, color: colors.textMuted, fontSize: 13 }}>
        Loading file tree...
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '8px 0',
      }}
    >
      {fileTree.children?.map((child) => (
        <TreeNode
          key={child.path || child.name}
          node={child}
          depth={0}
          selectedFiles={selectedFiles}
          onSelect={selectFile}
          onToggleSelect={toggleFileSelection}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: FileTreeNode;
  depth: number;
  selectedFiles: string[];
  onSelect: (path: string) => void;
  onToggleSelect: (path: string) => void;
}

function TreeNode({ node, depth, selectedFiles, onSelect, onToggleSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === 'directory';
  const isSelected = selectedFiles.includes(node.path);
  const langColor = node.language ? languageColors[node.language] : undefined;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDir) {
        setExpanded(!expanded);
      } else if (node.supported !== false) {
        if (e.metaKey || e.ctrlKey) {
          onToggleSelect(node.path);
        } else {
          onSelect(node.path);
        }
      }
    },
    [isDir, expanded, node.path, node.supported, onSelect, onToggleSelect]
  );

  return (
    <div>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px 3px',
          paddingLeft: depth * 16 + 8,
          cursor: node.supported === false ? 'default' : 'pointer',
          background: isSelected ? 'rgba(74, 158, 255, 0.1)' : 'transparent',
          color: node.supported === false ? colors.textMuted : colors.textPrimary,
          fontSize: 13,
          userSelect: 'none',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => {
          if (node.supported !== false) {
            (e.currentTarget as HTMLElement).style.background = isSelected
              ? 'rgba(74, 158, 255, 0.15)'
              : colors.surfaceHover;
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = isSelected
            ? 'rgba(74, 158, 255, 0.1)'
            : 'transparent';
        }}
      >
        {isDir ? (
          <>
            {expanded ? <ChevronDown size={14} color={colors.textMuted} /> : <ChevronRight size={14} color={colors.textMuted} />}
            {expanded ? <FolderOpen size={14} color={colors.textSecondary} /> : <Folder size={14} color={colors.textSecondary} />}
          </>
        ) : (
          <>
            <span style={{ width: 14 }} />
            <FileText size={14} color={langColor || colors.textMuted} />
          </>
        )}

        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>

        {!isDir && node.function_count !== undefined && node.function_count > 0 && (
          <span
            style={{
              fontSize: 10,
              color: colors.textMuted,
              background: colors.border,
              padding: '0 4px',
              borderRadius: 3,
            }}
          >
            {node.function_count}f
          </span>
        )}

        {!isDir && node.supported === false && (
          <span style={{ fontSize: 10, color: colors.textMuted }}>unsupported</span>
        )}
      </div>

      {isDir && expanded && node.children?.map((child) => (
        <TreeNode
          key={child.path || child.name}
          node={child}
          depth={depth + 1}
          selectedFiles={selectedFiles}
          onSelect={onSelect}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
