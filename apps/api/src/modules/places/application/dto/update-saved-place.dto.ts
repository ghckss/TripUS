import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDefined, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

import { PlacePreference, PlaceTag } from '../../domain/entities/saved-place.entity';

export class UpdateSavedPlaceDto {
  @ApiPropertyOptional({ type: String, maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 180 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional({ type: String, maxLength: 300, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ type: Number, minimum: -90, maximum: 90, nullable: true })
  @ValidateIf((input: UpdateSavedPlaceDto) => input.latitude !== undefined || input.longitude !== undefined)
  @IsDefined()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ type: Number, minimum: -180, maximum: 180, nullable: true })
  @ValidateIf((input: UpdateSavedPlaceDto) => input.latitude !== undefined || input.longitude !== undefined)
  @IsDefined()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ enum: PlaceTag, enumName: 'PlaceTag' })
  @IsOptional()
  @IsEnum(PlaceTag)
  tag?: PlaceTag;

  @ApiPropertyOptional({ enum: PlacePreference, enumName: 'PlacePreference' })
  @IsOptional()
  @IsEnum(PlacePreference)
  preference?: PlacePreference;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  isPrimaryLodging?: boolean;
}
