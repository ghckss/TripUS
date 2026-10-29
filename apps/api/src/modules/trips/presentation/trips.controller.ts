import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CreateTripDto } from '../application/dto/create-trip.dto';
import { TripResponseDto } from '../application/dto/trip-response.dto';
import { TripsService } from '../application/trips.service';

@ApiTags('trips')
@Controller('trips')
export class TripsController {
  constructor(@Inject(TripsService) private readonly trips: TripsService) {}

  @Get()
  @ApiOkResponse({ type: TripResponseDto, isArray: true })
  list(): Promise<TripResponseDto[]> {
    return this.trips.list();
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ type: TripResponseDto })
  create(@Body() input: CreateTripDto): Promise<TripResponseDto> {
    return this.trips.create(input);
  }

  @Get(':tripId')
  @ApiOkResponse({ type: TripResponseDto })
  get(@Param('tripId', new ParseUUIDPipe()) tripId: string): Promise<TripResponseDto> {
    return this.trips.get(tripId);
  }
}
