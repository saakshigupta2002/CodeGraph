import { useState } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { colors } from '../../utils/colors';

const tips = [
  { id: 'sidebar', text: 'Pick a file here', position: { top: 200, left: 260 }, arrow: 'left' },
  { id: 'canvas', text: 'Your graph appears here', position: { top: 300, left: '50%' }, arrow: 'none' },
  { id: 'search', text: 'Search with Cmd+K', position: { top: 60, right: 200 }, arrow: 'top' },
];

export function OnboardingTooltips() {
  const { showOnboarding, dismissOnboarding } = useUIStore();
  const [currentTip, setCurrentTip] = useState(0);

  if (!showOnboarding) return null;

  const tip = tips[currentTip];
  if (!tip) {
    dismissOnboarding();
    return null;
  }

  const advance = () => {
    if (currentTip >= tips.length - 1) {
      dismissOnboarding();
    } else {
      setCurrentTip(currentTip + 1);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        ...tip.position as any,
        zIndex: 300,
        background: colors.accent,
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 8,
        fontSize: 13,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
      }}
      onClick={advance}
    >
      {tip.text}
      <button onClick={(e) => { e.stopPropagation(); dismissOnboarding(); }} style={{ color: 'rgba(255,255,255,0.7)' }}>
        <X size={14} />
      </button>
      <span style={{ fontSize: 10, opacity: 0.7 }}>{currentTip + 1}/{tips.length}</span>
    </div>
  );
}
