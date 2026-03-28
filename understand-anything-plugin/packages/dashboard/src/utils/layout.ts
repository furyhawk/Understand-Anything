import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { LayoutMessage, LayoutResult } from "./layout.worker";

export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 120;

/**
 * Synchronous dagre layout — used for small graphs.
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return { ...node, position: { x: 0, y: 0 } };
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

let _worker: Worker | null = null;
let _nextRequestId = 0;
let _latestRequestId = -1;
const _pending = new Map<
  number,
  {
    nodes: Node[];
    edges: Edge[];
    resolve: (v: { nodes: Node[]; edges: Edge[] }) => void;
    reject: (reason?: unknown) => void;
  }
>();

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(
      new URL("./layout.worker.ts", import.meta.url),
      { type: "module" },
    );

    _worker.onmessage = (e: MessageEvent<LayoutResult>) => {
      const { requestId, positions } = e.data;
      const entry = _pending.get(requestId);
      _pending.delete(requestId);

      // S1: Discard stale results — only honour the latest request.
      if (!entry || requestId !== _latestRequestId) return;

      const layoutedNodes = entry.nodes.map((node) => ({
        ...node,
        position: positions[node.id] ?? { x: 0, y: 0 },
      }));

      entry.resolve({ nodes: layoutedNodes, edges: entry.edges });
    };

    _worker.onerror = (err: ErrorEvent) => {
      for (const [, entry] of _pending) {
        entry.reject(err);
      }
      _pending.clear();
    };
  }
  return _worker;
}

/**
 * Async dagre layout via Web Worker — used for large graphs.
 * Keeps the main thread responsive while dagre computes positions.
 *
 * Uses request-ID correlation so concurrent calls never cross-wire,
 * and only the latest request's result is honoured (stale ones are discarded).
 */
export function applyDagreLayoutAsync(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    const requestId = _nextRequestId++;
    _latestRequestId = requestId;

    _pending.set(requestId, { nodes, edges, resolve, reject });

    const msg: LayoutMessage = {
      requestId,
      nodes: nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
      direction,
    };

    worker.postMessage(msg);
  });
}
