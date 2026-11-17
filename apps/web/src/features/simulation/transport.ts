import type { SimClientMessage, SimServerMessage } from '@sds/shared';
import { SIMULATION_SOCKET_PATH } from './constants';
import { SIMULATION_CONNECTION_LOST, SIMULATION_FAILED } from './messages';

export type SimulationMode = 'local' | 'server';

export interface SimulationTransport {
  send(message: SimClientMessage): void;
  close(): void;
}

export interface TransportHandlers {
  onMessage(message: SimServerMessage): void;
  onFailure(message: string): void;
}

function openWorker(handlers: TransportHandlers): SimulationTransport {
  const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = (event: MessageEvent<SimServerMessage>) =>
    handlers.onMessage(event.data);
  worker.onerror = (event) => {
    event.preventDefault();
    handlers.onFailure(SIMULATION_FAILED);
  };
  return {
    send: (message) => worker.postMessage(message),
    close: () => worker.terminate(),
  };
}

function socketUrl(): URL {
  const url = new URL(SIMULATION_SOCKET_PATH, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url;
}

function openSocket(handlers: TransportHandlers): SimulationTransport {
  const socket = new WebSocket(socketUrl());
  const pending: string[] = [];
  let ended = false;

  socket.onopen = () => {
    for (const raw of pending.splice(0)) socket.send(raw);
  };
  socket.onmessage = (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as SimServerMessage;
    if (message.type !== 'tick') ended = true;
    handlers.onMessage(message);
  };
  socket.onclose = () => {
    if (!ended) handlers.onFailure(SIMULATION_CONNECTION_LOST);
  };

  return {
    send: (message) => {
      const raw = JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) socket.send(raw);
      else if (socket.readyState === WebSocket.CONNECTING) pending.push(raw);
    },
    close: () => {
      ended = true;
      socket.close();
    },
  };
}

export function openTransport(
  mode: SimulationMode,
  handlers: TransportHandlers,
): SimulationTransport {
  return mode === 'server' ? openSocket(handlers) : openWorker(handlers);
}
