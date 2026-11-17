import type { IncomingMessage } from 'node:http';
import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import { SkipThrottle } from '@nestjs/throttler';
import type { SimClientMessage, SimServerMessage, User } from '@sds/shared';
import { WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service.js';
import { readCookie, SESSION_COOKIE } from '../auth/cookies.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { INVALID_MESSAGE } from './message-parser.js';
import {
  SimulationLimitError,
  SimulationsService,
  type ActiveSimulation,
  type SimulationSink,
} from './simulations.service.js';

type Message<T extends SimClientMessage['type']> = Extract<
  SimClientMessage,
  { type: T }
>;

interface Connection {
  user: Promise<User>;
  sim: ActiveSimulation | null;
  closed: boolean;
}

class Rejection extends Error {}

function closeWithError(socket: WebSocket, message: string): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  const error: SimServerMessage = { type: 'error', message };
  socket.send(JSON.stringify(error));
  socket.close(1000);
}

function sinkFor(socket: WebSocket): SimulationSink {
  return {
    send: (raw) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(raw);
    },
    end: () => socket.close(1000),
  };
}

@SkipThrottle()
@WebSocketGateway({ path: '/simulations' })
export class SimulationsGateway
  implements OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>
{
  private readonly logger = new Logger(SimulationsGateway.name);
  private readonly connections = new WeakMap<WebSocket, Connection>();
  private readonly webOrigin: string;

  constructor(
    private readonly auth: AuthService,
    private readonly simulations: SimulationsService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.webOrigin = new URL(config.webUrl).origin;
  }

  handleConnection(socket: WebSocket, request: IncomingMessage): void {
    const user = this.authenticate(request);
    this.connections.set(socket, { user, sim: null, closed: false });
    user.catch((error: unknown) => {
      if (!(error instanceof Rejection)) this.logger.error(error);
      closeWithError(
        socket,
        error instanceof Rejection
          ? error.message
          : 'Could not verify your session.',
      );
    });
  }

  handleDisconnect(socket: WebSocket): void {
    const connection = this.connections.get(socket);
    if (!connection) return;
    connection.closed = true;
    if (connection.sim) void this.simulations.stop(connection.sim);
  }

  @SubscribeMessage('start')
  async onStart(
    @ConnectedSocket() socket: WebSocket,
    @MessageBody() message: Message<'start'>,
  ): Promise<void> {
    const connection = await this.ready(socket);
    if (!connection) return;
    if (connection.sim) {
      return closeWithError(socket, 'This simulation has already started.');
    }
    const user = await connection.user;
    try {
      const { diagram, scenario, seed } = message;
      connection.sim = await this.simulations.start(
        user.id,
        { diagram, scenario, seed },
        sinkFor(socket),
      );
    } catch (error) {
      if (!(error instanceof SimulationLimitError)) this.logger.error(error);
      return closeWithError(
        socket,
        error instanceof SimulationLimitError
          ? error.message
          : 'Could not start the simulation.',
      );
    }
    if (connection.closed) await this.simulations.stop(connection.sim);
  }

  @SubscribeMessage('diagram')
  async onDiagram(
    @ConnectedSocket() socket: WebSocket,
    @MessageBody() { diagram }: Message<'diagram'>,
  ): Promise<void> {
    const sim = (await this.ready(socket))?.sim;
    if (sim) await this.simulations.update(sim, { diagram });
  }

  @SubscribeMessage('scenario')
  async onScenario(
    @ConnectedSocket() socket: WebSocket,
    @MessageBody() { scenario }: Message<'scenario'>,
  ): Promise<void> {
    const sim = (await this.ready(socket))?.sim;
    if (sim) await this.simulations.update(sim, { scenario });
  }

  @SubscribeMessage(INVALID_MESSAGE)
  onInvalid(
    @ConnectedSocket() socket: WebSocket,
    @MessageBody() reason: string,
  ): void {
    closeWithError(socket, `Invalid message: ${reason}`);
  }

  private async authenticate(request: IncomingMessage): Promise<User> {
    if (request.headers.origin !== this.webOrigin) {
      throw new Rejection('Origin not allowed.');
    }
    const token = readCookie(request, SESSION_COOKIE);
    const user = token ? await this.auth.findSessionUser(token) : null;
    if (!user) {
      throw new Rejection('Sign in to run simulations on the server.');
    }
    return user;
  }

  private async ready(socket: WebSocket): Promise<Connection | null> {
    const connection = this.connections.get(socket);
    if (!connection) return null;
    const signedIn = await connection.user.then(
      () => true,
      () => false,
    );
    return signedIn && !connection.closed ? connection : null;
  }
}
