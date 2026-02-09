import { X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { colors } from '../../utils/colors';

const borderColors: Record<string, string> = {
  success: colors.tested,
  warning: colors.partial,
  error: colors.untested,
  info: colors.textMuted,
};

export function ToastStack() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderLeft: `3px solid ${borderColors[toast.type] || colors.textMuted}`,
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 280,
            maxWidth: 400,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            animation: 'slideIn 0.2s ease',
          }}
        >
          <span style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} style={{ color: colors.textMuted, padding: 2 }}>
            <X size={14} />
          </button>
        </div>
      ))}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
