// Dagre layout helpers for React Flow
import dagre from 'dagre';
import type { Edge, Node } from '@xyflow/react';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 50;

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } {
  // For disconnected or sparsely connected graphs (e.g. modules view),
  // use a grid layout instead of dagre to avoid all nodes on one rank
  const connectedNodeIds = new Set<string>();
  edges.forEach((e) => {
    connectedNodeIds.add(e.source);
    connectedNodeIds.add(e.target);
  });
  const disconnectedRatio = nodes.length > 0
    ? (nodes.length - connectedNodeIds.size) / nodes.length
    : 0;

  if (nodes.length > 10 && (edges.length === 0 || disconnectedRatio > 0.5)) {
    return getGridLayout(nodes, edges);
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));

  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    edgesep: 20,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    if (!nodeWithPosition) return node;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/** Grid layout for disconnected/sparse graphs */
function getGridLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const gapX = NODE_WIDTH + 40;
  const gapY = NODE_HEIGHT + 30;

  const layoutedNodes = nodes.map((node, i) => ({
    ...node,
    position: {
      x: (i % cols) * gapX + 40,
      y: Math.floor(i / cols) * gapY + 40,
    },
  }));

  return { nodes: layoutedNodes, edges };
}
