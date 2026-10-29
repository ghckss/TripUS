import { Body, Controller, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { TransitRouteRequestDto, TransitRouteResponseDto } from '../application/dto/transit-route.dto';
import { RoutesService } from '../application/routes.service';

@ApiTags('routes')
@Controller('trips/:tripId/routes')
export class RoutesController {
  constructor(@Inject(RoutesService) private readonly routes: RoutesService) {}

  @Post('transit')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: TransitRouteRequestDto })
  @ApiOkResponse({ type: TransitRouteResponseDto })
  transit(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() input: TransitRouteRequestDto,
  ): Promise<TransitRouteResponseDto> {
    return this.routes.transit(tripId, input);
  }
}
