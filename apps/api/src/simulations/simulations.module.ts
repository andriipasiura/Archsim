import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SIM_QUEUE } from '@sds/shared';
import { AuthModule } from '../auth/auth.module.js';
import { SimulationBus } from './simulation-bus.js';
import { SimulationsGateway } from './simulations.gateway.js';
import { SimulationsService } from './simulations.service.js';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: SIM_QUEUE,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
    }),
  ],
  providers: [SimulationBus, SimulationsService, SimulationsGateway],
})
export class SimulationsModule {}
