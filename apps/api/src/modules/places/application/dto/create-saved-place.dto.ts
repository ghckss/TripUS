import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

import { PlacePreference, PlaceTag } from '../../domain/entities/saved-place.entity';

export class CreateSavedPlaceDto {
  @ApiPropertyOptional({ type: String, maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId?: string;

  @ApiProperty({ type: String, example: '국립현대미술관 서울', maxLength: 180 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ type: String, maxLength: 300, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ type: Number, minimum: -90, maximum: 90, nullable: true })
  @ValidateIf((input: CreateSavedPlaceDto) => input.latitude !== undefined || input.longitude !== undefined)
  @IsDefined()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ type: Number, minimum: -180, maximum: 180, nullable: true })
  @ValidateIf((input: CreateSavedPlaceDto) => input.latitude !== undefined || input.longitude !== undefined)
  @IsDefined()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiProperty({ enum: PlaceTag, enumName: 'PlaceTag' })
  @IsEnum(PlaceTag)
  tag!: PlaceTag;

  @ApiProperty({ enum: PlacePreference, enumName: 'PlacePreference' })
  @IsEnum(PlacePreference)
  preference!: PlacePreference;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimaryLodging?: boolean;
}
