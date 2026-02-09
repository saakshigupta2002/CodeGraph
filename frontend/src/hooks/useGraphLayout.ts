import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

export function useGraphLayout() {
  const { fitView, zoomTo, getZoom } = useReactFlow();

  const fitToScreen = useCallback(() => {
    fitView({ padding: 0.1, duration: 300 });
  }, [fitView]);

  return { fitToScreen, zoomTo, getZoom };
}
