import { Simulation } from '@sds/sim-engine';
import { TICK_MS } from './constants';
import type { WorkerRequest, WorkerResponse } from './protocol';

let sim: Simulation | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

const post = (message: WorkerResponse) => self.postMessage(message);

function run() {
  if (!sim) return;
  post({ type: 'tick', metrics: sim.step() });
  if (sim.done) {
    clearInterval(timer);
    post({ type: 'done' });
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  switch (message.type) {
    case 'start':
      clearInterval(timer);
      sim = new Simulation(message.diagram, message.scenario, {
        seed: message.seed,
        tickMs: TICK_MS,
      });
      timer = setInterval(run, TICK_MS);
      break;
    case 'diagram':
      sim?.setDiagram(message.diagram);
      break;
    case 'scenario':
      sim?.setScenario(message.scenario);
      break;
  }
};
