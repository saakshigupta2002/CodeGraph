import { useEffect, useState } from 'react';
import { X, Key, Cog, Monitor, BarChart3 } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { colors } from '../../utils/colors';

export function SettingsPage() {
  const { settingsOpen, toggleSettings, addToast } = useUIStore();
  const { settings, loadSettings, updateSettings, setApiKey, loading } = useSettingsStore();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [excludeInput, setExcludeInput] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');

  useEffect(() => {
    if (settingsOpen) {
      loadSettings();
    }
  }, [settingsOpen, loadSettings]);

  useEffect(() => {
    if (settings) {
      setExcludeInput(settings.exclude_patterns?.join(', ') || '');
      setDailyLimit(String(settings.daily_limit || ''));
      setModel(settings.ai_model || 'gpt-4o-mini');
    }
  }, [settings]);

  if (!settingsOpen) return null;

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    const valid = await setApiKey(apiKeyInput.trim());
    if (valid) {
      addToast('success', 'API key saved');
      setApiKeyInput('');
    } else {
      addToast('error', 'Invalid API key');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings({
        exclude_patterns: excludeInput.split(',').map((s) => s.trim()).filter(Boolean) as any,
        daily_limit: parseInt(dailyLimit) || 0,
        ai_model: model,
      });
      addToast('success', 'Settings saved');
    } catch (e: any) {
      addToast('error', e.message);
    }
  };

  const models = [
    'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo',
    'o1-mini', 'o1-preview',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={toggleSettings}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxHeight: '80vh',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600 }}>Settings</span>
          <button onClick={toggleSettings} style={{ color: colors.textMuted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* API Key Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Key size={16} color={colors.textSecondary} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>API Key</span>
            </div>
            {settings?.api_key_set && (
              <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
                Current: {settings.api_key_masked}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={settings?.api_key_set ? 'Enter new key to change' : 'sk-...'}
                type="password"
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSaveKey}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  background: colors.accent,
                  color: '#fff',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                {settings?.api_key_set ? 'Change' : 'Save'}
              </button>
            </div>
          </section>

          {/* Analysis Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Cog size={16} color={colors.textSecondary} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>Analysis</span>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: colors.textMuted, display: 'block', marginBottom: 4 }}>
                Exclude patterns (comma-separated globs)
              </label>
              <input
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                placeholder="node_modules, dist, build"
                style={{ width: '100%' }}
              />
            </div>
          </section>

          {/* Display Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Monitor size={16} color={colors.textSecondary} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>Display</span>
            </div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>
              Light mode toggle coming in a future update.
            </div>
          </section>

          {/* Usage Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <BarChart3 size={16} color={colors.textSecondary} />
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>Usage</span>
            </div>
            {settings && (
              <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
                API calls today: {settings.daily_usage}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: colors.textMuted, display: 'block', marginBottom: 4 }}>
                  Daily limit (0 = unlimited)
                </label>
                <input
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  type="number"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: colors.textMuted, display: 'block', marginBottom: 4 }}>
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 6,
                    color: colors.textPrimary,
                    fontSize: 13,
                  }}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Save button */}
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: colors.accent,
              color: '#fff',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              width: '100%',
            }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
