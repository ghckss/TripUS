import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class TransitRouteRequestDto {
  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  originSavedPlaceId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  destinationSavedPlaceId!: string;

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
