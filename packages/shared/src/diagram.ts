import { z } from 'zod';
import type { BlockType } from './block-type.js';

export const DIAGRAM_VERSION = 1;
export const NAME_MAX_LENGTH = 64;

interface ParamLimit {
  min: number;
  max?: number;
  integer: boolean;
}

export const PARAM_LIMITS = {
  capacityRps: { min: 1, integer: true },
  replicas: { min: 1, max: 1000, integer: true },
  baseLatencyMs: { min: 0, integer: false },
  queueSize: { min: 0, integer: true },
  timeoutMs: { min: 1, integer: false },
  hitRate: { min: 0, max: 1, integer: false },
} as const satisfies Record<string, ParamLimit>;

function numberField(limit: ParamLimit) {
  const base = (limit.integer ? z.number().int() : z.number()).min(limit.min);
  return limit.max === undefined ? base : base.max(limit.max);
}

const commonParamsSchema = z.strictObject({
  capacityRps: numberField(PARAM_LIMITS.capacityRps),
  replicas: numberField(PARAM_LIMITS.replicas),
  baseLatencyMs: numberField(PARAM_LIMITS.baseLatencyMs),
  queueSize: numberField(PARAM_LIMITS.queueSize),
  timeoutMs: numberField(PARAM_LIMITS.timeoutMs),
});

const cacheParamsSchema = commonParamsSchema.extend({
  hitRate: numberField(PARAM_LIMITS.hitRate),
});

export type CommonParams = z.infer<typeof commonParamsSchema>;
export type CacheParams = z.infer<typeof cacheParamsSchema>;
export type ParamKey = keyof CacheParams;

const nodeFields = {
  id: z.string().min(1),
  name: z.string().max(NAME_MAX_LENGTH),
  position: z.object({ x: z.number(), y: z.number() }),
};

const nodeSchema = z.discriminatedUnion('type', [
  z.object({
    ...nodeFields,
    type: z.literal('load-balancer'),
    params: commonParamsSchema,
  }),
  z.object({
    ...nodeFields,
    type: z.literal('service'),
    params: commonParamsSchema,
  }),
  z.object({
    ...nodeFields,
    type: z.literal('postgres'),
    params: commonParamsSchema,
  }),
  z.object({
    ...nodeFields,
    type: z.literal('queue'),
    params: commonParamsSchema,
  }),
  z.object({
    ...nodeFields,
    type: z.literal('redis'),
    params: cacheParamsSchema,
  }),
  z.object({
    ...nodeFields,
    type: z.literal('cdn'),
    params: cacheParamsSchema,
  }),
]);

const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
});

export type DiagramNode = z.infer<typeof nodeSchema>;
export type DiagramEdge = z.infer<typeof edgeSchema>;
export type BlockParams<T extends BlockType = BlockType> = Extract<
  DiagramNode,
  { type: T }
>['params'];

interface EdgeEnds {
  source: string;
  target: string;
}

export function canConnect(
  edges: readonly EdgeEnds[],
  source: string,
  target: string,
): boolean {
  if (source === target) return false;
  return !edges.some((e) => e.source === source && e.target === target);
}

const diagramSchema = z
  .object({
    version: z.literal(DIAGRAM_VERSION),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
  })
  .superRefine((diagram, ctx) => {
    const nodeIds = new Set<string>();
    diagram.nodes.forEach((node, i) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate node id "${node.id}"`,
          path: ['nodes', i, 'id'],
        });
      }
      nodeIds.add(node.id);
    });

    const edgeIds = new Set<string>();
    const accepted: EdgeEnds[] = [];
    diagram.edges.forEach((edge, i) => {
      const path = ['edges', i];
      if (edgeIds.has(edge.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate edge id "${edge.id}"`,
          path: [...path, 'id'],
        });
      }
      edgeIds.add(edge.id);
      for (const end of ['source', 'target'] as const) {
        if (!nodeIds.has(edge[end])) {
          ctx.addIssue({
            code: 'custom',
            message: `Edge ${end} "${edge[end]}" is not a node`,
            path: [...path, end],
          });
        }
      }
      if (!canConnect(accepted, edge.source, edge.target)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Self-loop or duplicate edge',
          path,
        });
      }
      accepted.push(edge);
    });
  });

export type Diagram = z.infer<typeof diagramSchema>;

export type ParseDiagramResult =
  { ok: true; diagram: Diagram } | { ok: false; error: string };

export function parseDiagram(input: unknown): ParseDiagramResult {
  const result = diagramSchema.safeParse(input);
  return result.success
    ? { ok: true, diagram: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}
