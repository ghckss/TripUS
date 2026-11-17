import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { ItineraryResponseDto, ItineraryUpdateResultDto, ReplaceItineraryDto } from '../application/dto/itinerary.dto';
import { ItinerariesService } from '../application/itineraries.service';

@ApiTags('itineraries')
@Controller('trips/:tripId/itinerary')
export class ItinerariesController {
  constructor(@Inject(ItinerariesService) private readonly itineraries: ItinerariesService) {}

  @Get()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: ItineraryResponseDto })
  get(@Param('tripId', new ParseUUIDPipe()) tripId: string): Promise<ItineraryResponseDto> {
    return this.itineraries.get(tripId);
  }

  @Put()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: ReplaceItineraryDto })
  @ApiOkResponse({ type: ItineraryUpdateResultDto })
  replace(@Param('tripId', new ParseUUIDPipe()) tripId: string, @Body() input: ReplaceItineraryDto): Promise<ItineraryUpdateResultDto> {
    return this.itineraries.replace(tripId, input.items, undefined, input.activities);
  }
}
