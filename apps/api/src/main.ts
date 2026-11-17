import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { APP_CONFIG, loadRootEnvFile, type AppConfig } from './config.js';
import { configureApp } from './setup.js';

async function bootstrap() {
  loadRootEnvFile();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  await app.listen(app.get<AppConfig>(APP_CONFIG).port);
}
await bootstrap();
