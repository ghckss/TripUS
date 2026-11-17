import { ItineraryBoundaryType } from '../../../itineraries/application/dto/itinerary.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class TransitRouteRequestDto {
  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  originSavedPlaceId?: string;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  destinationSavedPlaceId?: string;

  @ApiPropertyOptional({ enum: ItineraryBoundaryType, enumName: 'ItineraryBoundaryType' })
  @IsOptional()
  @IsEnum(ItineraryBoundaryType)
  originBoundaryType?: ItineraryBoundaryType;

  @ApiPropertyOptional({ enum: ItineraryBoundaryType, enumName: 'ItineraryBoundaryType' })
  @IsOptional()
  @IsEnum(ItineraryBoundaryType)
  destinationBoundaryType?: ItineraryBoundaryType;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  departureTime?: string;
}

export enum TransitRouteStatus {
  Available = 'available',
  Unavailable = 'unavailable',
}

export class TransitRouteResponseDto {
  @ApiProperty({ enum: TransitRouteStatus, enumName: 'TransitRouteStatus' })
  status!: TransitRouteStatus;

  @ApiPropertyOptional({ type: Number, nullable: true })
  durationMinutes!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  distanceMeters!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  reason!: string | null;
}
