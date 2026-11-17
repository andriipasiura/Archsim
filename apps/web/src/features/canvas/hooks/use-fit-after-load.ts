import { useReactFlow } from '@xyflow/react';
import { FIT_VIEW_OPTIONS } from '../constants';

export function useFitAfterLoad(): () => void {
  const { fitView } = useReactFlow();
  return () => requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
}
