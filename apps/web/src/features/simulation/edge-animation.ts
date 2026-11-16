import { useSimulation } from './store';

export const FLOW_DOT_SLOTS = 8;
const DOT_SPEED_PX_PER_SEC = 140;

interface FlowEdgeElements {
  target: string;
  path: SVGPathElement;
  dots: SVGCircleElement[];
}

const edges = new Map<string, FlowEdgeElements>();
let frame = 0;

function dotCount(rps: number): number {
  if (rps <= 0) return 0;
  return Math.min(
    FLOW_DOT_SLOTS,
    Math.max(1, Math.ceil(Math.log10(rps + 1) * 2)),
  );
}

function hide(dots: readonly SVGCircleElement[], from = 0) {
  for (let i = from; i < dots.length; i++) dots[i]!.style.display = 'none';
}

function draw(now: number) {
  const metrics = useSimulation.getState().latest;
  for (const [id, { target, path, dots }] of edges) {
    const count = dotCount(metrics?.edges[id] ?? 0);
    hide(dots, count);
    if (count === 0) continue;
    const length = path.getTotalLength();
    if (length === 0) continue;
    const critical = metrics?.blocks[target]?.state === 'critical';
    const offset = ((now / 1000) * DOT_SPEED_PX_PER_SEC) / length;
    for (let i = 0; i < count; i++) {
      const dot = dots[i]!;
      const point = path.getPointAtLength(((offset + i / count) % 1) * length);
      dot.setAttribute('cx', String(point.x));
      dot.setAttribute('cy', String(point.y));
      dot.style.fill = critical ? 'var(--status-critical)' : 'var(--primary)';
      dot.style.display = '';
    }
  }
  frame = requestAnimationFrame(draw);
}

function setRunning(running: boolean) {
  if (running && frame === 0) {
    frame = requestAnimationFrame(draw);
  } else if (!running && frame !== 0) {
    cancelAnimationFrame(frame);
    frame = 0;
    for (const { dots } of edges.values()) hide(dots);
  }
}

useSimulation.subscribe((s, prev) => {
  if (s.status !== prev.status) setRunning(s.status === 'running');
});

export function registerFlowEdge(
  id: string,
  target: string,
  group: SVGGElement,
): () => void {
  const path = group.querySelector('path');
  if (!path) return () => {};
  edges.set(id, {
    target,
    path,
    dots: [...group.querySelectorAll('circle')],
  });
  return () => edges.delete(id);
}
