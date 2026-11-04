import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiTags } from '@nestjs/swagger';

import { writeStructuredLog } from '../../../common/http/json-logger';
import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { IngestEventsDto } from '../application/dto/ingest-events.dto';

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(@Inject(IDENTITY_PORT) private readonly identity: IdentityPort) {}

  @Post('events')
  @HttpCode(202)
  @ApiBody({ type: IngestEventsDto })
  @ApiAcceptedResponse({ description: 'Events accepted for structured application logging' })
  ingest(@Body() input: IngestEventsDto): void {
    const userId = this.identity.getCurrentUserId();
    for (const event of input.events) {
      writeStructuredLog('info', 'product.event', {
        eventName: event.name,
        occurredAt: event.occurredAt,
        properties: event.properties ?? {},
        userId,
      });
    }
  }
}
