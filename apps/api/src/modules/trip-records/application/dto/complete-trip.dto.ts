import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested } from 'class-validator';

import { ItineraryResponseDto } from '../../../itineraries/application/dto/itinerary.dto';
import { TripResponseDto } from '../../../trips/application/dto/trip-response.dto';

export class CompleteTripItemDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  itineraryItemId!: string;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  notVisited?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  review?: string;
}

export class CompleteTripDto {
  @ApiProperty({ type: CompleteTripItemDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompleteTripItemDto)
  items!: CompleteTripItemDto[];
}

export class CompleteTripResponseDto {
  @ApiProperty({ type: TripResponseDto })
  trip!: TripResponseDto;

  @ApiProperty({ type: ItineraryResponseDto })
  itinerary!: ItineraryResponseDto;
}
