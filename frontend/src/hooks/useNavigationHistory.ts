import { useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { useGraphStore } from '../store/graphStore';

export function useNavigationHistory() {
  const pushNavigation = useUIStore((s) => s.pushNavigation);
  const navigateBack = useUIStore((s) => s.navigateBack);
  const selectNode = useGraphStore((s) => s.selectNode);

  const navigateToNode = useCallback(
    (nodeId: string) => {
      pushNavigation(nodeId);
      selectNode(nodeId);
    },
    [pushNavigation, selectNode]
  );

  const goBack = useCallback(() => {
    const prev = navigateBack();
    if (prev) selectNode(prev);
  }, [navigateBack, selectNode]);

  return { navigateToNode, goBack };
}
