import { useReactFlow, useStore } from '@xyflow/react';
import { FIT_VIEW_OPTIONS, PERCENT, ZOOM_ANIMATION } from '../constants';

export function useZoomControls() {
  const zoom = useStore((s) => s.transform[2]);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return {
    zoomLabel: `${Math.round(zoom * PERCENT)}%`,
    zoomIn: () => void zoomIn(ZOOM_ANIMATION),
    zoomOut: () => void zoomOut(ZOOM_ANIMATION),
    fit: () => void fitView({ ...FIT_VIEW_OPTIONS, ...ZOOM_ANIMATION }),
  };
}
