import { useState, useCallback } from 'react';
import { Upload, Github, FolderOpen, ArrowRight, Key } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useProjectStore } from '../../store/projectStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useUIStore } from '../../store/uiStore';
import { useGraphStore } from '../../store/graphStore';
import { colors } from '../../utils/colors';

export function LandingPage() {
  const { projects, loading, error, uploadProject, importGithub, setCurrentProject, loadFileTree } = useProjectStore();
  const { settings, setApiKey } = useSettingsStore();
  const { addToast } = useUIStore();
  const loadGraph = useGraphStore.getState().loadGraph;

  const [githubUrl, setGithubUrl] = useState('');
  const [pat, setPat] = useState('');
  const [apiKey, setApiKeyInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setUploadProgress('Uploading...');
      try {
        const project = await uploadProject(file);
        setUploadProgress('');
        addToast('success', `Project "${project.name}" loaded`);
        loadGraph(project.id);
        loadFileTree();
      } catch (e: any) {
        setUploadProgress('');
        addToast('error', e.message);
      }
    },
    [uploadProject, addToast, loadGraph, loadFileTree]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
  });

  const handleGithubImport = async () => {
    if (!githubUrl.trim()) return;
    setUploadProgress('Cloning repository...');
    try {
      const project = await importGithub(githubUrl, pat || undefined);
      setUploadProgress('');
      addToast('success', `Project "${project.name}" loaded`);
      loadGraph(project.id);
      loadFileTree();
    } catch (e: any) {
      setUploadProgress('');
      addToast('error', e.message);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) return;
    const valid = await setApiKey(apiKey.trim());
    if (valid) {
      addToast('success', 'API key saved');
      setApiKeyInput('');
    } else {
      addToast('error', 'Invalid API key');
    }
  };

  const handleOpenProject = (project: any) => {
    setCurrentProject(project);
    loadGraph(project.id);
    loadFileTree();
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 600, width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: colors.textPrimary, marginBottom: 8 }}>
            CodeGraph
          </h1>
          <p style={{ fontSize: 14, color: colors.textSecondary }}>
            A living X-ray of your codebase
          </p>
        </div>

        {/* Upload */}
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? colors.accent : colors.border}`,
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'border-color 0.2s',
            background: isDragActive ? 'rgba(74, 158, 255, 0.05)' : 'transparent',
          }}
        >
          <input {...getInputProps()} />
          <Upload size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, color: colors.textPrimary, marginBottom: 4 }}>
            Upload Project
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted }}>
            Drag & drop a .zip file here, or click to browse
          </div>
        </div>

        {/* GitHub */}
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Github size={18} color={colors.textSecondary} />
            <span style={{ fontSize: 15, color: colors.textPrimary }}>Connect GitHub Repo</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleGithubImport}
              disabled={!githubUrl.trim() || loading}
              style={{
                padding: '8px 16px',
                background: colors.accent,
                color: '#fff',
                borderRadius: 6,
                fontSize: 13,
                opacity: !githubUrl.trim() || loading ? 0.5 : 1,
              }}
            >
              Import
            </button>
          </div>
          <input
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="Personal Access Token (for private repos)"
            type="password"
            style={{ width: '100%' }}
          />
        </div>

        {/* Progress */}
        {uploadProgress && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: colors.surface,
              marginBottom: 16,
              fontSize: 13,
              color: colors.accent,
              textAlign: 'center',
            }}
          >
            {uploadProgress}
          </div>
        )}

        {/* API Key */}
        {!settings?.api_key_set && (
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Key size={18} color={colors.textSecondary} />
              <span style={{ fontSize: 14, color: colors.textPrimary }}>OpenAI API Key</span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>(optional)</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={apiKey}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                type="password"
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSaveApiKey}
                style={{
                  padding: '8px 16px',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                Save
              </button>
            </div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>
              Required for AI explanations and natural language search. Skip if you want to use graph features only.
            </div>
          </div>
        )}

        {/* Recent projects */}
        {projects.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>Recent Projects</div>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => handleOpenProject(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  width: '100%',
                  textAlign: 'left',
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  marginBottom: 8,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <FolderOpen size={16} color={colors.textSecondary} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: colors.textPrimary }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: colors.textMuted }}>
                    {p.stats?.file_count || 0} files · {p.stats?.function_count || 0} functions
                  </div>
                </div>
                <ArrowRight size={14} color={colors.textMuted} />
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, color: colors.untested, fontSize: 13, textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
