import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { colors } from '../../utils/colors';
import type { TestStatus as TestStatusType } from '../../types';

interface Props {
  testStatus: TestStatusType;
}

export function TestStatus({ testStatus }: Props) {
  const statusConfig = {
    covered: { icon: CheckCircle, color: colors.tested, label: 'Covered' },
    uncovered: { icon: XCircle, color: colors.untested, label: 'Not covered' },
    partial: { icon: AlertCircle, color: colors.partial, label: 'Partial' },
  };

  const config = statusConfig[testStatus.status] || statusConfig.uncovered;
  const Icon = config.icon;

  return (
    <div>
      <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>
        TEST STATUS
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <Icon size={16} color={config.color} />
        <span style={{ fontSize: 13, color: config.color }}>{config.label}</span>
      </div>

      {testStatus.test_files.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 4 }}>
            Test files ({testStatus.test_files.length})
          </div>
          {testStatus.test_files.map((f) => (
            <div key={f} style={{ fontSize: 12, color: colors.textSecondary, padding: '2px 0' }}>
              {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
