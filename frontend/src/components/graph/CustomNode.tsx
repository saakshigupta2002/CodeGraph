import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, FileText, Braces, Variable, Import, Package } from 'lucide-react';
import { languageColors, colors } from '../../utils/colors';

const typeIcons: Record<string, typeof Box> = {
  class: Box,
  function: Braces,
  variable: Variable,
  import: Import,
  file: FileText,
  module: Package,
};

function CustomNode({ data, selected }: NodeProps) {
  const {
    label,
    nodeType,
    language,
    filePath,
    metadata,
    borderColor = colors.border,
    opacity = 1,
    incomingCount = 0,
    outgoingCount = 0,
    testCovered,
    isEntryPoint = false,
  } = data as Record<string, any>;

  const Icon = typeIcons[nodeType] || FileText;
  const langColor = language ? languageColors[language] || colors.textMuted : undefined;

  const displayLabel = label && label.length > 25 ? label.slice(0, 24) + '\u2026' : label;
  const parentClass = metadata?.parent_class;
  const methodCount = metadata?.method_count;

  const borderWidth = isEntryPoint ? 2.5 : 1.5;
  const boxShadow = isEntryPoint ? `0 0 8px ${borderColor}44` : undefined;

  return (
    <div
      style={{
        position: 'relative',
        background: selected ? colors.surfaceHover : colors.surface,
        border: `${borderWidth}px solid ${selected ? colors.accent : borderColor}`,
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 140,
        maxWidth: 220,
        opacity,
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        boxShadow,
      }}
      title={label}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />

      {/* Test status dot */}
      {testCovered !== null && testCovered !== undefined && (
        <span
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: testCovered ? colors.tested : colors.untested,
          }}
          title={testCovered ? 'Test covered' : 'No test coverage'}
        />
      )}

      {/* Main row: icon + label + language/method badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} color={borderColor} style={{ flexShrink: 0 }} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayLabel}
        </span>

        {langColor && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: langColor,
              flexShrink: 0,
              marginLeft: 'auto',
            }}
            title={language}
          />
        )}

        {methodCount !== undefined && (
          <span
            style={{
              fontSize: 10,
              color: colors.textMuted,
              background: colors.border,
              padding: '1px 5px',
              borderRadius: 4,
              marginLeft: langColor ? 0 : 'auto',
            }}
          >
            {methodCount}
          </span>
        )}
      </div>

      {/* File path / parent class subtitle */}
      {(parentClass || filePath) && (
        <div
          style={{
            fontSize: 11,
            color: colors.textMuted,
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {parentClass || filePath}
        </div>
      )}

      {/* Connection counts row */}
      {(incomingCount > 0 || outgoingCount > 0) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
          {incomingCount > 0 && (
            <span style={{ fontSize: 9, color: colors.textMuted }}>
              {'\u2190'}{incomingCount}
            </span>
          )}
          {outgoingCount > 0 && (
            <span style={{ fontSize: 9, color: colors.textMuted }}>
              {'\u2192'}{outgoingCount}
            </span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
}

export default memo(CustomNode);
