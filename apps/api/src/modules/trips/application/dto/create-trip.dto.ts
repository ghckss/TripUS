import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { TripRegionDto } from './trip-region.dto';
import { TripBoundaryPointDto } from './trip-boundary-point.dto';

export class CreateTripDto {
  @ApiProperty({ type: String, example: '서울 가을 여행', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ type: String, example: '서울', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  @ApiPropertyOptional({ type: TripRegionDto, isArray: true, maxItems: 10, default: [] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TripRegionDto)
  regions?: TripRegionDto[];

  @ApiProperty({ type: String, example: 'Asia/Seoul', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ type: String, example: '2026-10-31', format: 'date' })
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ type: String, example: '2026-11-02', format: 'date' })
  @IsDateString({ strict: true })
  endDate!: string;

  @ApiPropertyOptional({ type: TripBoundaryPointDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripBoundaryPointDto)
  startPoint?: TripBoundaryPointDto | null;

  @ApiPropertyOptional({ type: TripBoundaryPointDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripBoundaryPointDto)
  endPoint?: TripBoundaryPointDto | null;
}
