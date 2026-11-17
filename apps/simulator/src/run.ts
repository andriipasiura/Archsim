import {
  SIM_TICK_MS,
  type SimControl,
  type SimJobData,
  type SimServerMessage,
} from '@sds/shared';
import { Simulation } from '@sds/sim-engine';

export type RunOutcome = 'done' | 'cancelled';

export class SimulationRun {
  private readonly sim: Simulation;
  private readonly emit: (message: SimServerMessage) => void;
  private rev = 0;
  private cancelled = false;
  private stop: (() => void) | null = null;

  constructor(job: SimJobData, emit: (message: SimServerMessage) => void) {
    this.sim = new Simulation(job.diagram, job.scenario, {
      seed: job.seed,
      tickMs: SIM_TICK_MS,
    });
    this.emit = emit;
  }

  apply(control: SimControl): void {
    if (control.rev <= this.rev) return;
    this.rev = control.rev;
    if (control.cancelled) {
      this.cancelled = true;
      this.stop?.();
      return;
    }
    this.sim.setDiagram(control.diagram);
    this.sim.setScenario(control.scenario);
  }

  run(signal: AbortSignal, intervalMs = SIM_TICK_MS): Promise<RunOutcome> {
    return new Promise((resolve, reject) => {
      if (this.cancelled) return resolve('cancelled');
      if (signal.aborted) return reject(signal.reason as Error);

      const finish = () => {
        clearInterval(timer);
        signal.removeEventListener('abort', onAbort);
        this.stop = null;
      };
      const onAbort = () => {
        finish();
        reject(signal.reason as Error);
      };
      this.stop = () => {
        finish();
        resolve('cancelled');
      };
      signal.addEventListener('abort', onAbort, { once: true });

      const timer = setInterval(() => {
        try {
          this.emit({ type: 'tick', metrics: this.sim.step() });
        } catch (error) {
          finish();
          return reject(error as Error);
        }
        if (this.sim.done) {
          finish();
          this.emit({ type: 'done' });
          resolve('done');
        }
      }, intervalMs);
    });
  }
}
