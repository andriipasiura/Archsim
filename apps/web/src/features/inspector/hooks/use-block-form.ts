import {
  NAME_MAX_LENGTH,
  PARAM_LIMITS,
  type CacheParams,
  type ParamKey,
} from '@sds/shared';
import { BLOCK_META } from '@/features/blocks';
import { PARAM_FIELDS } from '../param-fields';
import { DISPLAY_DECIMALS } from '../constants';
import type { BlockNode } from '@/features/diagram';
import { selectSingleSelected, useEditor } from '@/features/diagram';

export interface ParamFieldModel {
  key: ParamKey;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number | undefined;
  integer: boolean;
  commit: (value: number) => void;
}

const roundForDisplay = (n: number) => Number(n.toFixed(DISPLAY_DECIMALS));

export function useSelectedBlock(): BlockNode | null {
  return useEditor(selectSingleSelected);
}

export function useBlockForm(node: BlockNode) {
  const renameBlock = useEditor((s) => s.renameBlock);
  const updateParam = useEditor((s) => s.updateParam);
  const params: Partial<CacheParams> = node.data.params;

  const fields = PARAM_FIELDS.flatMap((spec): ParamFieldModel[] => {
    const stored = params[spec.key];
    if (stored === undefined) return [];
    const limit: { min: number; max?: number; integer: boolean } =
      PARAM_LIMITS[spec.key];
    const scale = spec.displayScale;
    return [
      {
        key: spec.key,
        label: spec.label,
        unit: spec.unit,
        value: roundForDisplay(stored * scale),
        min: limit.min * scale,
        max: limit.max === undefined ? undefined : limit.max * scale,
        integer: limit.integer,
        commit: (value) =>
          updateParam(node.id, spec.key, roundForDisplay(value / scale)),
      },
    ];
  });

  return {
    typeLabel: BLOCK_META[node.data.type].label,
    description: BLOCK_META[node.data.type].description,
    name: {
      value: node.data.name,
      maxLength: NAME_MAX_LENGTH,
      commit: (name: string) => renameBlock(node.id, name),
    },
    fields,
  };
}
