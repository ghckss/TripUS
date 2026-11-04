import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module';
import { TelemetryController } from './presentation/telemetry.controller';

@Module({
  imports: [IdentityModule],
  controllers: [TelemetryController],
})
export class TelemetryModule {}
