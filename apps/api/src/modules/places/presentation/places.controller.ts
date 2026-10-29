import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CreateSavedPlaceDto } from '../application/dto/create-saved-place.dto';
import { SavedPlaceResponseDto, SavePlaceResultDto } from '../application/dto/saved-place-response.dto';
import { PlacesService } from '../application/places.service';
import { PlaceSearchCandidateDto, SearchPlacesQueryDto } from '../application/dto/search-places.dto';

@ApiTags('places')
@Controller('trips/:tripId/places')
export class PlacesController {
  constructor(@Inject(PlacesService) private readonly places: PlacesService) {}

  @Get()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: SavedPlaceResponseDto, isArray: true })
  list(@Param('tripId', new ParseUUIDPipe()) tripId: string): Promise<SavedPlaceResponseDto[]> {
    return this.places.list(tripId);
  }

  @Get('search')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'query', type: String, minLength: 2 })
  @ApiOkResponse({ type: PlaceSearchCandidateDto, isArray: true })
  search(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Query() input: SearchPlacesQueryDto,
  ): Promise<PlaceSearchCandidateDto[]> {
    return this.places.search(tripId, input.query);
  }

  @Post()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: CreateSavedPlaceDto })
  @ApiCreatedResponse({ type: SavePlaceResultDto })
  create(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() input: CreateSavedPlaceDto,
  ): Promise<SavePlaceResultDto> {
    return this.places.create(tripId, input);
  }
}
