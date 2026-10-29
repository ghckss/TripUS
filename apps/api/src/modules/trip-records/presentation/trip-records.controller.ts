import { Body, Controller, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { CompleteTripDto, CompleteTripResponseDto } from '../application/dto/complete-trip.dto';
import { TripRecordsService } from '../application/trip-records.service';

@ApiTags('trip-records')
@Controller('trips/:tripId/completion')
export class TripRecordsController {
  constructor(@Inject(TripRecordsService) private readonly records: TripRecordsService) {}

  @Post()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: CompleteTripDto })
  @ApiOkResponse({ type: CompleteTripResponseDto })
  complete(@Param('tripId', new ParseUUIDPipe()) tripId: string, @Body() input: CompleteTripDto): Promise<CompleteTripResponseDto> {
    return this.records.complete(tripId, input);
  }
}
