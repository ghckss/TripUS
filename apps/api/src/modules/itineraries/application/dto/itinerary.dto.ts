import { ACTIVITY_LOCATION_TYPES, ITINERARY_ACTIVITY_TYPES, type ItineraryActivity } from '../../domain/itinerary-activity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

import { ItineraryItemEntity, ItinerarySource, VisitStatus } from '../../domain/entities/itinerary-item.entity';

export enum ItineraryBoundaryType {
  StartPoint = 'start_point',
  EndPoint = 'end_point',
}

export class ItineraryItemResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  savedPlaceId!: string;

  @ApiProperty({ type: String })
  placeName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  latitude!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  longitude!: number | null;

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  date!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  position!: number | null;

  @ApiPropertyOptional({ type: String, example: '10:30', nullable: true })
  scheduledTime!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  durationMinutes!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  activitySummary!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  travelMethod!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  travelDurationMinutes!: number | null;

  @ApiProperty({ type: Boolean })
  locked!: boolean;

  @ApiProperty({ enum: ItinerarySource, enumName: 'ItinerarySource' })
  source!: ItinerarySource;

  @ApiPropertyOptional({ enum: VisitStatus, enumName: 'VisitStatus', nullable: true })
  visitStatus!: VisitStatus | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  rating!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  review!: string | null;

  @ApiPropertyOptional({ enum: ItineraryBoundaryType, enumName: 'ItineraryBoundaryType', nullable: true })
  boundaryType?: ItineraryBoundaryType | null;

  static fromEntity(entity: ItineraryItemEntity): ItineraryItemResponseDto {
    return {
      id: entity.id,
      savedPlaceId: entity.savedPlaceId,
      placeName: entity.savedPlace.name,
      address: entity.savedPlace.address,
      latitude: entity.savedPlace.latitude,
      longitude: entity.savedPlace.longitude,
      date: entity.date,
      position: entity.position,
      scheduledTime: entity.scheduledTime?.slice(0, 5) ?? null,
      durationMinutes: entity.durationMinutes,
      activitySummary: entity.activitySummary,
      travelMethod: null,
      travelDurationMinutes: null,
      locked: entity.locked,
      source: entity.source,
      visitStatus: entity.visitStatus,
      rating: entity.rating,
      review: entity.review,
      boundaryType: null,
    };
  }
}

export class UnplacedPlaceResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  savedPlaceId!: string;

  @ApiProperty({ type: String })
  placeName!: string;
}

export class ItineraryActivityDto implements ItineraryActivity {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiProperty({ enum: ITINERARY_ACTIVITY_TYPES, enumName: 'ItineraryActivityType' })
  @IsIn(ITINERARY_ACTIVITY_TYPES)
  type!: ItineraryActivity['type'];

  @ApiProperty({ type: String, maxLength: 500 })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ type: String, example: '13:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  durationMinutes!: number;

  @ApiProperty({ enum: ACTIVITY_LOCATION_TYPES, nullable: true })
  @IsOptional()
  @IsIn(ACTIVITY_LOCATION_TYPES)
  locationType!: ItineraryActivity['locationType'];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  savedPlaceId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  locationName!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  fromLocation!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  toLocation!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  travelMethod!: string | null;

}

export class ItineraryResponseDto {
  @ApiPropertyOptional({ type: ItineraryActivityDto, isArray: true })
  activities?: ItineraryActivityDto[];

  @ApiProperty({ type: ItineraryItemResponseDto, isArray: true })
  items!: ItineraryItemResponseDto[];

  @ApiProperty({ type: UnplacedPlaceResponseDto, isArray: true })
  unplaced!: UnplacedPlaceResponseDto[];
}

export class ReplaceItineraryItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  savedPlaceId!: string;

  @ApiProperty({ type: String, format: 'date' })
  @IsDateString({ strict: true })
  date!: string;

  @ApiProperty({ type: Number, minimum: 0 })
  @IsInt()
  @Min(0)
  position!: number;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  @ApiPropertyOptional({ type: String, example: '10:30' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  scheduledTime?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  activitySummary?: string;

  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  travelMethod?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  travelDurationMinutes?: number;
}

export class ReplaceItineraryDto {
  @ApiPropertyOptional({ type: ItineraryActivityDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryActivityDto)
  activities?: ItineraryActivityDto[];

  @ApiProperty({ type: ReplaceItineraryItemDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceItineraryItemDto)
  items!: ReplaceItineraryItemDto[];
}

export enum ItineraryUpdateStatus {
  Updated = 'updated',
  Conflict = 'conflict',
}

export class ItineraryUpdateResultDto {
  @ApiProperty({ enum: ItineraryUpdateStatus, enumName: 'ItineraryUpdateStatus' })
  status!: ItineraryUpdateStatus;

  @ApiProperty({ type: String, isArray: true })
  conflicts!: string[];

  @ApiProperty({ type: ItineraryResponseDto })
  itinerary!: ItineraryResponseDto;
}
