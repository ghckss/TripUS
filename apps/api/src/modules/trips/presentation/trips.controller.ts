import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CreateTripDto } from '../application/dto/create-trip.dto';
import { TripResponseDto } from '../application/dto/trip-response.dto';
import { TripsService } from '../application/trips.service';
import { ListTripsQueryDto } from '../application/dto/list-trips-query.dto';
import { TripListStatus } from '../application/dto/list-trips-query.dto';
import { UpdateTripDto } from '../application/dto/update-trip.dto';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(@Inject(TripsService) private readonly trips: TripsService) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: TripListStatus })
  @ApiOkResponse({ type: TripResponseDto, isArray: true })
  list(@Query() query: ListTripsQueryDto): Promise<TripResponseDto[]> {
    return this.trips.list(query.status);
  }

  @Post()
  @HttpCode(201)
  @ApiBody({ type: CreateTripDto })
  @ApiCreatedResponse({ type: TripResponseDto })
  create(@Body() input: CreateTripDto): Promise<TripResponseDto> {
    return this.trips.create(input);
  }

  @Get(':tripId')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: TripResponseDto })
  get(@Param('tripId', new ParseUUIDPipe()) tripId: string): Promise<TripResponseDto> {
    return this.trips.get(tripId);
  }

  @Patch(':tripId')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateTripDto })
  @ApiOkResponse({ type: TripResponseDto })
  update(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() input: UpdateTripDto,
  ): Promise<TripResponseDto> {
    return this.trips.update(tripId, input);
  }

  @Delete(':tripId')
  @HttpCode(204)
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  remove(@Param('tripId', new ParseUUIDPipe()) tripId: string): Promise<void> {
    return this.trips.remove(tripId);
  }
}
