import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';
import { parseClientMessage } from './simulations/message-parser.js';

const JSON_BODY_LIMIT = '1mb';

export function configureApp(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useWebSocketAdapter(
    new WsAdapter(app, {
      messageParser: parseClientMessage,
      maxConcurrentMessages: 1,
    }),
  );
  app.enableShutdownHooks();
}
