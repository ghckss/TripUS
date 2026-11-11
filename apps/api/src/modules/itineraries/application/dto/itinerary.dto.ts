import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { ItineraryItemEntity, ItinerarySource, VisitStatus } from '../../domain/entities/itinerary-item.entity';

export class ItineraryItemResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
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
      travelMethod: entity.travelMethod,
      travelDurationMinutes: entity.travelDurationMinutes,
      locked: entity.locked,
      source: entity.source,
      visitStatus: entity.visitStatus,
      rating: entity.rating,
      review: entity.review,
    };
  }
}

export class UnplacedPlaceResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  savedPlaceId!: string;

  @ApiProperty({ type: String })
  placeName!: string;
}

export class ItineraryResponseDto {
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

  @ApiPropertyOptional({ type: Number, minimum: 15, maximum: 720 })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(720)
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

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 720 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  travelDurationMinutes?: number;
}

export class ReplaceItineraryDto {
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
