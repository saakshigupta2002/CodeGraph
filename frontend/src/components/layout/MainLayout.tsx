import { ReactFlowProvider } from '@xyflow/react';
import { TopBar } from './TopBar';
import { TabsBar } from './TabsBar';
import { Breadcrumbs } from './Breadcrumbs';
import { FileTree } from '../sidebar/FileTree';
import { GraphCanvas } from '../graph/GraphCanvas';
import { DetailPanel } from '../detail/DetailPanel';
import { SearchPalette } from '../search/SearchPalette';
import { SettingsPage } from '../settings/SettingsPage';
import { ContextMenu } from '../common/ContextMenu';
import { FileModal } from '../common/Modal';
import { ShortcutOverlay } from '../common/ShortcutOverlay';
import { ToastStack } from '../common/Toast';
import { OnboardingTooltips } from '../onboarding/OnboardingTooltips';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { colors } from '../../utils/colors';

export function MainLayout() {
  useKeyboardShortcuts();

  return (
    <ReactFlowProvider>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colors.bg }}>
        {/* Top Bar */}
        <TopBar />

        {/* Tabs */}
        <TabsBar />

        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left sidebar */}
          <div
            style={{
              width: 250,
              borderRight: `1px solid ${colors.border}`,
              background: colors.surface,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <FileTree />
          </div>

          {/* Center canvas */}
          <GraphCanvas />

          {/* Right detail panel */}
          <DetailPanel />
        </div>

        {/* Overlays */}
        <SearchPalette />
        <SettingsPage />
        <ContextMenu />
        <FileModal />
        <ShortcutOverlay />
        <ToastStack />
        <OnboardingTooltips />
      </div>
    </ReactFlowProvider>
  );
}
