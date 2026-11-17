import type {
  Scenario,
  SimClientMessage,
  SimServerMessage,
  TickMetrics,
} from '@sds/shared';
import { create } from 'zustand';
import { toDiagram, useEditor, type EditorStore } from '@/features/diagram';
import { DEFAULT_SCENARIO, HISTORY_POINTS, SEED } from './constants';
import {
  openTransport,
  type SimulationMode,
  type SimulationTransport,
} from './transport';

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
  mode: SimulationMode;
  scenario: Scenario;
  latest: TickMetrics | null;
  history: ChartPoint[];
}

interface SimulationActions {
  start(mode: SimulationMode): void;
  stop(): void;
  setMode(mode: SimulationMode): void;
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

let session: {
  transport: SimulationTransport;
  unsubscribe: () => void;
} | null = null;

function endSession() {
  session?.transport.close();
  session?.unsubscribe();
  session = null;
}

function send(message: SimClientMessage) {
  session?.transport.send(message);
}

export const useSimulation = create<SimulationState & SimulationActions>()(
  (set, get) => ({
    status: 'idle',
    mode: 'local',
    scenario: DEFAULT_SCENARIO,
    latest: null,
    history: [],

    start: (mode) => {
      endSession();
      const fail = (message: string) => {
        endSession();
        set({ status: 'idle' });
        useEditor.getState().setNotice(message);
      };
      const onMessage = (message: SimServerMessage) => {
        if (message.type === 'tick') {
          set((s) => ({
            latest: message.metrics,
            history: [...s.history, toPoint(message.metrics)].slice(
              -HISTORY_POINTS,
            ),
          }));
        } else if (message.type === 'done') {
          endSession();
          set({ status: 'finished' });
        } else {
          fail(message.message);
        }
      };
      const transport = openTransport(mode, { onMessage, onFailure: fail });
      const unsubscribe = useEditor.subscribe((next, prev) => {
        if (diagramStructureChanged(prev, next)) {
          send({ type: 'diagram', diagram: currentDiagram() });
        }
      });
      session = { transport, unsubscribe };
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

    setMode: (mode) => set({ mode }),

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
