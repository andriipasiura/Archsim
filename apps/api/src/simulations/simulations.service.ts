import { randomUUID } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  SIM_JOB_TIMEOUT_MS,
  SIM_QUEUE,
  simEventsChannel,
  type Diagram,
  type Scenario,
  type SimJobData,
  type SimServerMessage,
} from '@sds/shared';
import type { Queue } from 'bullmq';
import { SimulationBus } from './simulation-bus.js';

export const MAX_SIMULATIONS_PER_USER = 2;
export const STALL_TIMEOUT_MS = 5_000;
const STATE_TTL_MS = 2 * SIM_JOB_TIMEOUT_MS;

export class SimulationLimitError extends Error {
  constructor() {
    super(
      `You can run up to ${MAX_SIMULATIONS_PER_USER} server simulations at once.`,
    );
  }
}

export interface SimulationSink {
  send(raw: string): void;
  end(): void;
}

export interface ActiveSimulation {
  readonly id: string;
  readonly userId: string;
  readonly sink: SimulationSink;
  diagram: Diagram;
  scenario: Scenario;
  rev: number;
  ended: boolean;
  watchdog: NodeJS.Timeout | undefined;
}

@Injectable()
export class SimulationsService {
  private readonly logger = new Logger(SimulationsService.name);

  constructor(
    @InjectQueue(SIM_QUEUE) private readonly queue: Queue<SimJobData>,
    private readonly bus: SimulationBus,
  ) {}

  async start(
    userId: string,
    job: SimJobData,
    sink: SimulationSink,
  ): Promise<ActiveSimulation> {
    const id = randomUUID();
    const acquired = await this.bus.acquireSlot(
      userId,
      id,
      MAX_SIMULATIONS_PER_USER,
      STATE_TTL_MS,
    );
    if (!acquired) throw new SimulationLimitError();

    const sim: ActiveSimulation = {
      id,
      userId,
      sink,
      diagram: job.diagram,
      scenario: job.scenario,
      rev: 0,
      ended: false,
      watchdog: undefined,
    };
    try {
      await this.bus.subscribe(simEventsChannel(id), (raw) =>
        this.onEvent(sim, raw),
      );
      await this.queue.add('run', job, { jobId: id });
    } catch (error) {
      await this.end(sim, false);
      throw error;
    }
    return sim;
  }

  async update(
    sim: ActiveSimulation,
    patch: { diagram: Diagram } | { scenario: Scenario },
  ): Promise<void> {
    if (sim.ended) return;
    Object.assign(sim, patch);
    sim.rev++;
    await this.publishControl(sim, false);
  }

  stop(sim: ActiveSimulation): Promise<void> {
    return this.end(sim, true);
  }

  private onEvent(sim: ActiveSimulation, raw: string): void {
    if (sim.ended) return;
    this.watch(sim);
    sim.sink.send(raw);
    const { type } = JSON.parse(raw) as SimServerMessage;
    if (type !== 'tick') {
      void this.end(sim, false);
      sim.sink.end();
    }
  }

  private watch(sim: ActiveSimulation): void {
    clearTimeout(sim.watchdog);
    sim.watchdog = setTimeout(() => {
      const message: SimServerMessage = {
        type: 'error',
        message: 'The simulation server stopped responding.',
      };
      sim.sink.send(JSON.stringify(message));
      sim.sink.end();
      void this.end(sim, true);
    }, STALL_TIMEOUT_MS);
  }

  private async end(sim: ActiveSimulation, cancel: boolean): Promise<void> {
    if (sim.ended) return;
    sim.ended = true;
    clearTimeout(sim.watchdog);
    if (cancel) sim.rev++;
    const results = await Promise.allSettled([
      this.bus.unsubscribe(simEventsChannel(sim.id)),
      this.bus.releaseSlot(sim.userId, sim.id),
      cancel ? this.publishControl(sim, true) : undefined,
    ]);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(`Cleanup of ${sim.id} failed`, result.reason);
      }
    }
  }

  private publishControl(
    sim: ActiveSimulation,
    cancelled: boolean,
  ): Promise<void> {
    const { rev, diagram, scenario } = sim;
    return this.bus.publishControl(
      sim.id,
      { rev, diagram, scenario, cancelled },
      STATE_TTL_MS,
    );
  }
}
