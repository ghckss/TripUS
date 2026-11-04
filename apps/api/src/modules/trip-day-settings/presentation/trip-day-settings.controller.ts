import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { ReplaceTripDaySettingsDto, TripDaySettingResponseDto } from '../application/dto/trip-day-settings.dto';
import { TripDaySettingsService } from '../application/trip-day-settings.service';

@ApiTags('trip-day-settings')
@Controller('trips/:tripId/day-settings')
export class TripDaySettingsController {
  constructor(@Inject(TripDaySettingsService) private readonly settings: TripDaySettingsService) {}

  @Get()
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiOkResponse({ type: TripDaySettingResponseDto, isArray: true })
  get(@Param('tripId', new ParseUUIDPipe()) tripId: string): Promise<TripDaySettingResponseDto[]> {
    return this.settings.get(tripId);
  }

  @Put()
  @ApiParam({ name: 'tripId', format: 'uuid' })
  @ApiBody({ type: ReplaceTripDaySettingsDto })
  @ApiOkResponse({ type: TripDaySettingResponseDto, isArray: true })
  replace(@Param('tripId', new ParseUUIDPipe()) tripId: string, @Body() input: ReplaceTripDaySettingsDto): Promise<TripDaySettingResponseDto[]> {
    return this.settings.replace(tripId, input);
  }
}
