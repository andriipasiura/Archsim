import type { Scenario, TickMetrics } from '@sds/sim-engine';
import { create } from 'zustand';
import { toDiagram, useEditor, type EditorStore } from '@/features/diagram';
import { DEFAULT_SCENARIO, HISTORY_POINTS, SEED } from './constants';
import { SIMULATION_FAILED } from './messages';
import type { WorkerRequest, WorkerResponse } from './protocol';

export type SimulationStatus = 'idle' | 'running' | 'finished';

export interface ChartPoint {
  timeSec: number;
  p95Ms: number;
  p99Ms: number;
  offeredRps: number;
  throughputRps: number;
  errorRate: number;
}

interface SimulationState {
  status: SimulationStatus;
  scenario: Scenario;
  latest: TickMetrics | null;
  history: ChartPoint[];
}

interface SimulationActions {
  start(): void;
  stop(): void;
  setScenario(patch: Partial<Scenario>): void;
}

export function diagramStructureChanged(
  prev: Pick<EditorStore, 'nodes' | 'edges'>,
  next: Pick<EditorStore, 'nodes' | 'edges'>,
): boolean {
  const edgesChanged =
    prev.edges !== next.edges &&
    (prev.edges.length !== next.edges.length ||
      prev.edges.some((e, i) => e.id !== next.edges[i]?.id));
  if (edgesChanged) return true;
  if (prev.nodes === next.nodes) return false;
  return (
    prev.nodes.length !== next.nodes.length ||
    prev.nodes.some(
      (n, i) => n.id !== next.nodes[i]?.id || n.data !== next.nodes[i]?.data,
    )
  );
}

function currentDiagram() {
  const { nodes, edges } = useEditor.getState();
  return toDiagram(nodes, edges);
}

function toPoint({ timeSec, overall }: TickMetrics): ChartPoint {
  return {
    timeSec,
    p95Ms: overall.p95Ms,
    p99Ms: overall.p99Ms,
    offeredRps: overall.offeredRps,
    throughputRps: overall.throughputRps,
    errorRate: overall.errorRate,
  };
}

let session: { worker: Worker; unsubscribe: () => void } | null = null;

function endSession() {
  session?.worker.terminate();
  session?.unsubscribe();
  session = null;
}

function send(message: WorkerRequest) {
  session?.worker.postMessage(message);
}

export const useSimulation = create<SimulationState & SimulationActions>()(
  (set, get) => ({
    status: 'idle',
    scenario: DEFAULT_SCENARIO,
    latest: null,
    history: [],

    start: () => {
      endSession();
      const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        if (message.type === 'tick') {
          set((s) => ({
            latest: message.metrics,
            history: [...s.history, toPoint(message.metrics)].slice(
              -HISTORY_POINTS,
            ),
          }));
        } else {
          endSession();
          set({ status: 'finished' });
        }
      };
      worker.onerror = (event) => {
        event.preventDefault();
        endSession();
        set({ status: 'idle' });
        useEditor.getState().setNotice(SIMULATION_FAILED);
      };
      const unsubscribe = useEditor.subscribe((next, prev) => {
        if (diagramStructureChanged(prev, next)) {
          send({ type: 'diagram', diagram: currentDiagram() });
        }
      });
      session = { worker, unsubscribe };
      send({
        type: 'start',
        diagram: currentDiagram(),
        scenario: get().scenario,
        seed: SEED,
      });
      set({ status: 'running', latest: null, history: [] });
    },

    stop: () => {
      endSession();
      set({ status: 'idle' });
    },

    setScenario: (patch) => {
      const scenario = { ...get().scenario, ...patch };
      set({ scenario });
      send({ type: 'scenario', scenario });
    },
  }),
);

export function useBlockStatus(id: string) {
  const state = useSimulation((s) => s.latest?.blocks[id]?.state ?? null);
  const load = useSimulation((s) => {
    const utilization = s.latest?.blocks[id]?.utilization;
    return utilization === undefined ? null : Math.round(utilization * 100);
  });
  return { state, load };
}
