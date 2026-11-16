import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { memo, useCallback } from 'react';
import { FLOW_DOT_SLOTS, registerFlowEdge } from '@/features/simulation';

const DOT_SLOTS = Array.from({ length: FLOW_DOT_SLOTS }, (_, i) => i);
const HIDDEN = { display: 'none' } as const;

function FlowEdge({
  id,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const ref = useCallback(
    (group: SVGGElement | null) =>
      group ? registerFlowEdge(id, target, group) : undefined,
    [id, target],
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerEnd && { markerEnd })}
        {...(style && { style })}
      />
      <g ref={ref} className="pointer-events-none" aria-hidden>
        <path d={path} fill="none" stroke="none" />
        {DOT_SLOTS.map((i) => (
          <circle key={i} r={3} style={HIDDEN} />
        ))}
      </g>
    </>
  );
}

export default memo(FlowEdge);
