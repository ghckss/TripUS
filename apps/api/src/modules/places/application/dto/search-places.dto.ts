import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SearchPlacesQueryDto {
  @ApiProperty({ type: String, minLength: 2 })
  @IsString()
  @MinLength(2)
  query!: string;
}

export class SearchPlacesInMapQueryDto extends SearchPlacesQueryDto {
  @ApiPropertyOptional({ type: Number, minimum: -90, maximum: 90 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  north?: number;

  @ApiPropertyOptional({ type: Number, minimum: -90, maximum: 90 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  south?: number;

  @ApiPropertyOptional({ type: Number, minimum: -180, maximum: 180 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  east?: number;

  @ApiPropertyOptional({ type: Number, minimum: -180, maximum: 180 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  west?: number;
}

export class SearchPlacesByDestinationQueryDto extends SearchPlacesQueryDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, example: '일본' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  destination!: string;
}

export class SearchCitiesQueryDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 120, example: '도쿄' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  query!: string;

  @ApiProperty({ type: String, minLength: 1, maxLength: 120, example: '일본' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  country!: string;

  @ApiProperty({ type: String, pattern: '^[A-Z]{2}$', example: 'JP' })
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
}

export class PlaceSearchCandidateDto {
  @ApiProperty({ type: String })
  googlePlaceId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  primaryType!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  latitude!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  longitude!: number | null;
}
