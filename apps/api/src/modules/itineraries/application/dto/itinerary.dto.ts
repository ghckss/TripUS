import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

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

  @ApiPropertyOptional({ type: String, format: 'date', nullable: true })
  date!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  position!: number | null;

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
      date: entity.date,
      position: entity.position,
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
}

export class ReplaceItineraryDto {
  @ApiProperty({ type: ReplaceItineraryItemDto, isArray: true })
  @IsArray()
  @ArrayUnique((item: ReplaceItineraryItemDto) => item.savedPlaceId)
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
