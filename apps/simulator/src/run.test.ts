import {
  DEFAULT_PARAMS,
  type Diagram,
  type SimJobData,
  type SimServerMessage,
} from '@sds/shared';
import { simulate } from '@sds/sim-engine';
import { describe, expect, it } from 'vitest';
import { SimulationRun } from './run.ts';

const diagram: Diagram = {
  version: 1,
  nodes: [
    {
      id: 'api',
      type: 'service',
      name: 'API',
      position: { x: 0, y: 0 },
      params: { ...DEFAULT_PARAMS.service },
    },
    {
      id: 'db',
      type: 'postgres',
      name: 'DB',
      position: { x: 0, y: 0 },
      params: { ...DEFAULT_PARAMS.postgres },
    },
  ],
  edges: [{ id: 'api-db', source: 'api', target: 'db' }],
};

const job: SimJobData = {
  diagram,
  scenario: { rps: 3000, readRatio: 0.8, durationSec: 10 },
  seed: 7,
};

function collect() {
  const messages: SimServerMessage[] = [];
  return { messages, emit: (m: SimServerMessage) => messages.push(m) };
}

const never = new AbortController().signal;

describe('SimulationRun', () => {
  it('emits the same ticks as a local run with the same seed', async () => {
    const { messages, emit } = collect();
    const outcome = await new SimulationRun(job, emit).run(never, 0);

    expect(outcome).toBe('done');
    const local = [...simulate(job.diagram, job.scenario, { seed: job.seed })];
    expect(messages).toEqual([
      ...local.map((metrics) => ({ type: 'tick', metrics })),
      { type: 'done' },
    ]);
  });

  it('applies newer control revisions and ignores stale ones', async () => {
    const { messages, emit } = collect();
    const run = new SimulationRun(job, emit);
    const scenario = { ...job.scenario, durationSec: 20 };
    run.apply({ rev: 2, diagram, scenario, cancelled: false });
    run.apply({ rev: 1, diagram, scenario: job.scenario, cancelled: false });

    await run.run(never, 0);
    expect(messages.filter((m) => m.type === 'tick')).toHaveLength(200);
  });

  it('stops when cancelled, before or during the run', async () => {
    const cancel = { rev: 1, diagram, scenario: job.scenario, cancelled: true };

    const early = new SimulationRun(job, () => undefined);
    early.apply(cancel);
    await expect(early.run(never, 0)).resolves.toBe('cancelled');

    const { messages, emit } = collect();
    const late = new SimulationRun(job, (m) => {
      emit(m);
      if (messages.length === 3) late.apply(cancel);
    });
    await expect(late.run(never, 0)).resolves.toBe('cancelled');
    expect(messages).toHaveLength(3);
  });

  it('rejects with the abort reason', async () => {
    const controller = new AbortController();
    const run = new SimulationRun(job, () => controller.abort(new Error('x')));
    await expect(run.run(controller.signal, 0)).rejects.toThrow('x');
  });
});
