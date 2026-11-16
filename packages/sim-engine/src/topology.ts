import type { BlockType, Diagram, DiagramNode } from '@sds/shared';

export interface Link {
  edgeId: string;
  target: string;
}

type Role = 'cache' | 'db' | 'queue' | 'call';

export type LinkGroups = Readonly<Record<Role, readonly Link[]>>;

export interface Topology {
  nodes: ReadonlyMap<string, DiagramNode>;
  order: readonly string[];
  children: ReadonlyMap<string, readonly Link[]>;
  groups: ReadonlyMap<string, LinkGroups>;
  entries: readonly string[];
}

const ROLE: Record<BlockType, Role> = {
  redis: 'cache',
  postgres: 'db',
  queue: 'queue',
  'load-balancer': 'call',
  service: 'call',
  cdn: 'call',
};

export function buildTopology(diagram: Diagram): Topology {
  const nodes = new Map(diagram.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, Link[]>(
    diagram.nodes.map((n) => [n.id, []]),
  );
  const hasIncoming = new Set<string>();
  for (const e of diagram.edges) {
    outgoing.get(e.source)?.push({ edgeId: e.id, target: e.target });
    hasIncoming.add(e.target);
  }

  const children = new Map<string, Link[]>();
  const visiting = new Set<string>();
  const postorder: string[] = [];
  const visit = (id: string) => {
    visiting.add(id);
    const kept: Link[] = [];
    for (const link of outgoing.get(id) ?? []) {
      if (visiting.has(link.target)) continue;
      kept.push(link);
      if (!children.has(link.target)) visit(link.target);
    }
    children.set(id, kept);
    visiting.delete(id);
    postorder.push(id);
  };
  const roots = diagram.nodes.filter((n) => !hasIncoming.has(n.id));
  const rest = diagram.nodes.filter((n) => hasIncoming.has(n.id));
  for (const n of [...roots, ...rest]) if (!children.has(n.id)) visit(n.id);
  const order = postorder.reverse();

  const groups = new Map<string, LinkGroups>();
  const indegree = new Map(order.map((id) => [id, 0]));
  for (const [id, links] of children) {
    const g: Record<Role, Link[]> = { cache: [], db: [], queue: [], call: [] };
    for (const link of links) {
      g[ROLE[nodes.get(link.target)!.type]].push(link);
      indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
    }
    groups.set(id, g);
  }

  const sources = order.filter((id) => indegree.get(id) === 0);
  const wired = sources.filter((id) => children.get(id)!.length > 0);

  return {
    nodes,
    order,
    children,
    groups,
    entries: wired.length > 0 ? wired : sources,
  };
}

export function hitRate(node: DiagramNode): number {
  return 'hitRate' in node.params ? node.params.hitRate : 0;
}

export interface EdgeFlow {
  link: Link;
  reads: number;
  writes: number;
}

function split(links: readonly Link[], reads: number, writes: number) {
  const n = links.length;
  return links.map((link) => ({ link, reads: reads / n, writes: writes / n }));
}

export function route(
  topology: Topology,
  id: string,
  reads: number,
  writes: number,
): EdgeFlow[] {
  const node = topology.nodes.get(id)!;
  const links = topology.children.get(id)!;
  if (links.length === 0) return [];
  reads *= 1 - hitRate(node);
  if (node.type === 'queue') return split(links, reads, writes);

  const g = topology.groups.get(id)!;
  let backendReads = reads;
  const flows: EdgeFlow[] = [];
  if (g.cache.length > 0) {
    flows.push(...split(g.cache, reads, 0));
    const share = reads / g.cache.length;
    backendReads = 0;
    for (const { target } of g.cache) {
      if (topology.children.get(target)!.length > 0) continue;
      backendReads += share * (1 - hitRate(topology.nodes.get(target)!));
    }
  }
  flows.push(
    ...split(g.db, backendReads, writes),
    ...split(g.call, backendReads, writes),
    ...split(g.queue, 0, writes),
  );
  return flows;
}
