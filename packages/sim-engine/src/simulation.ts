import type { Diagram, DiagramNode } from '@sds/shared';
import { createRng, exponential, normal, pick, type Rng } from './rng.js';
import {
  buildTopology,
  hitRate,
  route,
  type Link,
  type Topology,
} from './topology.js';
import type {
  BlockMetrics,
  BlockState,
  Scenario,
  SimulationOptions,
  TickMetrics,
} from './types.js';

export const STATE_THRESHOLDS = {
  warn: 0.7,
  critical: 0.95,
  errorRate: 0.01,
} as const;

const DEFAULT_TICK_MS = 100;
const DEFAULT_SEED = 1;
const REQUEST_SAMPLES = 200;
const BLOCK_SAMPLES = 20;
const WINDOW_TICKS = 10;
const MAX_RHO = 0.95;
const UTILIZATION_SMOOTHING = 0.3;
const DOWNSTREAM_SMOOTHING = 0.3;
const WORKER_HEADROOM = 4;

export function blockState(utilization: number, errorRate: number): BlockState {
  if (
    utilization >= STATE_THRESHOLDS.critical ||
    errorRate > STATE_THRESHOLDS.errorRate
  ) {
    return 'critical';
  }
  return utilization >= STATE_THRESHOLDS.warn ? 'warn' : 'ok';
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
}

const ema = (prev: number, next: number, alpha: number) =>
  prev + alpha * (next - prev);

interface BlockRuntime {
  queue: number;
  readShare: number;
  utilization: number;
  downstreamMs: number;
  samples: number[][];
  inRps: number;
  servedRps: number;
  errorRps: number;
  errorFraction: number;
  waitMs: number;
  jitterMs: number;
  meanMs: number;
}

function freshRuntime(): BlockRuntime {
  return {
    queue: 0,
    readShare: 1,
    utilization: 0,
    downstreamMs: 0,
    samples: [],
    inRps: 0,
    servedRps: 0,
    errorRps: 0,
    errorFraction: 0,
    waitMs: 0,
    jitterMs: 0,
    meanMs: 0,
  };
}

interface WindowEntry {
  latencies: number[];
  failed: number;
}

export class Simulation {
  private topology!: Topology;
  private scenario: Scenario;
  private readonly rng: Rng;
  private readonly dt: number;
  private tick = 0;
  private blocks = new Map<string, BlockRuntime>();
  private window: WindowEntry[] = [];

  constructor(
    diagram: Diagram,
    scenario: Scenario,
    options: SimulationOptions = {},
  ) {
    this.rng = createRng(options.seed ?? DEFAULT_SEED);
    this.dt = (options.tickMs ?? DEFAULT_TICK_MS) / 1000;
    this.scenario = scenario;
    this.setDiagram(diagram);
  }

  get done(): boolean {
    return this.tick * this.dt >= this.scenario.durationSec;
  }

  setDiagram(diagram: Diagram): void {
    this.topology = buildTopology(diagram);
    const next = new Map<string, BlockRuntime>();
    for (const id of this.topology.nodes.keys()) {
      next.set(id, this.blocks.get(id) ?? freshRuntime());
    }
    this.blocks = next;
  }

  setScenario(scenario: Scenario): void {
    this.scenario = scenario;
  }

  step(): TickMetrics {
    this.tick++;
    const { topology, dt } = this;
    const { rps, readRatio } = this.scenario;

    const expected = rps * dt;
    const arrivals = Math.max(
      0,
      expected + Math.sqrt(expected) * normal(this.rng),
    );

    const inflow = new Map<string, { reads: number; writes: number }>();
    for (const id of topology.order) inflow.set(id, { reads: 0, writes: 0 });
    for (const id of topology.entries) {
      const share = arrivals / topology.entries.length;
      inflow.set(id, {
        reads: share * readRatio,
        writes: share * (1 - readRatio),
      });
    }

    const edges: Record<string, number> = {};
    for (const id of topology.order) {
      const served = this.process(id, inflow.get(id)!);
      for (const { link, reads, writes } of route(
        topology,
        id,
        served.reads,
        served.writes,
      )) {
        const target = inflow.get(link.target)!;
        target.reads += reads;
        target.writes += writes;
        edges[link.edgeId] = (reads + writes) / dt;
      }
    }

    this.updateDownstreamLatency();
    return this.collect(arrivals, edges);
  }

  private process(id: string, flow: { reads: number; writes: number }) {
    const node = this.topology.nodes.get(id)!;
    const b = this.blocks.get(id)!;
    const p = node.params;
    const dt = this.dt;

    const arrivals = flow.reads + flow.writes;
    if (arrivals > 0) b.readShare = flow.reads / arrivals;

    const capacity = this.capacity(node, b);
    const total = b.queue + arrivals;
    const served = Math.min(total, capacity * dt);
    let queue = total - served;

    const timeoutBacklog =
      (Math.max(0, p.timeoutMs - p.baseLatencyMs) / 1000) * capacity;
    const maxQueue = Math.min(p.queueSize, timeoutBacklog);
    const errors = Math.max(0, queue - maxQueue);
    queue -= errors;

    const rho = arrivals / (capacity * dt);
    const rhoCapped = Math.min(rho, MAX_RHO);
    b.queue = queue;
    b.utilization =
      this.tick === 1 ? rho : ema(b.utilization, rho, UTILIZATION_SMOOTHING);
    b.inRps = arrivals / dt;
    b.servedRps = served / dt;
    b.errorRps = errors / dt;
    b.errorFraction = total > 0 ? errors / total : 0;
    b.waitMs = (queue / capacity) * 1000;
    b.jitterMs = (p.baseLatencyMs * rhoCapped) / (1 - rhoCapped);
    b.meanMs = p.baseLatencyMs + b.jitterMs + b.waitMs;

    return { reads: served * b.readShare, writes: served * (1 - b.readShare) };
  }

  private capacity(node: DiagramNode, b: BlockRuntime): number {
    const p = node.params;
    const nominal = p.capacityRps * p.replicas;
    if (node.type !== 'service') return nominal;
    const busyMs = Math.max(p.baseLatencyMs, 1);
    const workers = (nominal * busyMs * WORKER_HEADROOM) / 1000;
    return Math.min(nominal, (workers * 1000) / (busyMs + b.downstreamMs));
  }

  private updateDownstreamLatency() {
    const pathMs = new Map<string, number>();
    for (const id of [...this.topology.order].reverse()) {
      const b = this.blocks.get(id)!;
      if (this.topology.nodes.get(id)!.type === 'queue') {
        pathMs.set(id, b.meanMs);
        continue;
      }
      let downstream = 0;
      for (const f of route(this.topology, id, b.readShare, 1 - b.readShare)) {
        downstream += (f.reads + f.writes) * pathMs.get(f.link.target)!;
      }
      b.downstreamMs = ema(b.downstreamMs, downstream, DOWNSTREAM_SMOOTHING);
      pathMs.set(id, b.meanMs + downstream);
    }
  }

  private sampleOwn(node: DiagramNode, b: BlockRuntime): number {
    return (
      node.params.baseLatencyMs + b.waitMs + exponential(this.rng, b.jitterMs)
    );
  }

  private walk(id: string, isRead: boolean): number | null {
    const { topology, rng } = this;
    const node = topology.nodes.get(id)!;
    const b = this.blocks.get(id)!;
    if (rng() < b.errorFraction) return null;

    let latency = this.sampleOwn(node, b);
    if (node.type === 'queue') return latency;
    if (isRead && rng() < hitRate(node)) return latency;

    const g = topology.groups.get(id)!;
    const call = (links: readonly Link[]) => {
      if (links.length === 0) return true;
      const sub = this.walk(pick(rng, links).target, isRead);
      if (sub === null) return false;
      latency += sub;
      return true;
    };

    if (isRead) {
      let missed = true;
      if (g.cache.length > 0) {
        const { target } = pick(rng, g.cache);
        const sub = this.walk(target, true);
        if (sub === null) return null;
        latency += sub;
        missed =
          topology.children.get(target)!.length === 0 &&
          rng() >= hitRate(topology.nodes.get(target)!);
      }
      if (missed && !(call(g.db) && call(g.call))) return null;
    } else if (!(call(g.db) && call(g.call) && call(g.queue))) {
      return null;
    }

    return latency > node.params.timeoutMs ? null : latency;
  }

  private collect(
    arrivals: number,
    edges: Record<string, number>,
  ): TickMetrics {
    const { topology, rng, dt, scenario } = this;

    const latencies: number[] = [];
    let failed = 0;
    if (scenario.rps > 0 && topology.entries.length > 0) {
      for (let i = 0; i < REQUEST_SAMPLES; i++) {
        const entry = pick(rng, topology.entries);
        const latency = this.walk(entry, rng() < scenario.readRatio);
        if (latency === null) failed++;
        else latencies.push(latency);
      }
    }
    this.window = [...this.window, { latencies, failed }].slice(-WINDOW_TICKS);
    const all = this.window.flatMap((w) => w.latencies);
    const totalFailed = this.window.reduce((sum, w) => sum + w.failed, 0);
    const total = all.length + totalFailed;
    const errorRate = total > 0 ? totalFailed / total : 0;
    const offeredRps = arrivals / dt;

    const blocks: Record<string, BlockMetrics> = {};
    for (const [id, node] of topology.nodes) {
      const b = this.blocks.get(id)!;
      const own: number[] = [];
      if (b.inRps > 0 || b.queue > 0) {
        for (let i = 0; i < BLOCK_SAMPLES; i++)
          own.push(this.sampleOwn(node, b));
      }
      b.samples = [...b.samples, own].slice(-WINDOW_TICKS);
      const samples = b.samples.flat();
      const blockErrorRate =
        b.inRps > 0 ? Math.min(1, b.errorRps / b.inRps) : 0;
      blocks[id] = {
        inRps: b.inRps,
        throughputRps: b.servedRps,
        errorRps: b.errorRps,
        errorRate: blockErrorRate,
        utilization: b.utilization,
        queueLength: b.queue,
        latencyMs: b.meanMs,
        p95Ms: percentile(samples, 0.95),
        p99Ms: percentile(samples, 0.99),
        state: blockState(b.utilization, blockErrorRate),
      };
    }

    return {
      tick: this.tick,
      timeSec: this.tick * dt,
      overall: {
        offeredRps,
        throughputRps: offeredRps * (1 - errorRate),
        errorRate,
        p95Ms: percentile(all, 0.95),
        p99Ms: percentile(all, 0.99),
      },
      blocks,
      edges,
    };
  }
}

export function* simulate(
  diagram: Diagram,
  scenario: Scenario,
  options?: SimulationOptions,
): Generator<TickMetrics> {
  const sim = new Simulation(diagram, scenario, options);
  while (!sim.done) yield sim.step();
}
