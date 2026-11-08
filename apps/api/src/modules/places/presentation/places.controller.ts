import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CreateSavedPlaceDto } from '../application/dto/create-saved-place.dto';
import { SavedPlaceResponseDto, SavePlaceResultDto } from '../application/dto/saved-place-response.dto';
import { PlacesService } from '../application/places.service';
import { PlaceSearchCandidateDto, SearchPlacesByDestinationQueryDto, SearchPlacesQueryDto } from '../application/dto/search-places.dto';
import { UpdateSavedPlaceDto } from '../application/dto/update-saved-place.dto';

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

  @Patch(':placeId')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiParam({ name: 'placeId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdateSavedPlaceDto })
  @ApiOkResponse({ type: SavedPlaceResponseDto })
  update(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('placeId', new ParseUUIDPipe()) placeId: string,
    @Body() input: UpdateSavedPlaceDto,
  ): Promise<SavedPlaceResponseDto> {
    return this.places.update(tripId, placeId, input);
  }

  @Delete(':placeId')
  @HttpCode(204)
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiParam({ name: 'placeId', type: String, format: 'uuid' })
  @ApiNoContentResponse()
  remove(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('placeId', new ParseUUIDPipe()) placeId: string,
  ): Promise<void> {
    return this.places.remove(tripId, placeId);
  }
}

@ApiTags('places')
@Controller('places')
export class PlaceDiscoveryController {
  constructor(@Inject(PlacesService) private readonly places: PlacesService) {}

  @Get('search')
  @ApiQuery({ name: 'query', type: String, minLength: 2 })
  @ApiQuery({ name: 'destination', type: String, minLength: 1, maxLength: 120 })
  @ApiOkResponse({ type: PlaceSearchCandidateDto, isArray: true })
  search(@Query() input: SearchPlacesByDestinationQueryDto): Promise<PlaceSearchCandidateDto[]> {
    return this.places.searchByDestination(input.query, input.destination);
  }
}
