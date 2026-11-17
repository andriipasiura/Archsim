import {
  SIM_TICK_MS,
  type SimClientMessage,
  type SimServerMessage,
} from '@sds/shared';
import { Simulation } from '@sds/sim-engine';

let sim: Simulation | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

const post = (message: SimServerMessage) => self.postMessage(message);

function run() {
  if (!sim) return;
  post({ type: 'tick', metrics: sim.step() });
  if (sim.done) {
    clearInterval(timer);
    post({ type: 'done' });
  }
}

self.onmessage = (event: MessageEvent<SimClientMessage>) => {
  const message = event.data;
  switch (message.type) {
    case 'start':
      clearInterval(timer);
      sim = new Simulation(message.diagram, message.scenario, {
        seed: message.seed,
        tickMs: SIM_TICK_MS,
      });
      timer = setInterval(run, SIM_TICK_MS);
      break;
    case 'diagram':
      sim?.setDiagram(message.diagram);
      break;
    case 'scenario':
      sim?.setScenario(message.scenario);
      break;
  }
};
