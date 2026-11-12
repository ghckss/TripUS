import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class TripBoundaryPointDto {
  @ApiProperty({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId!: string | null;

  @ApiProperty({ type: String, maxLength: 120 })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '15:30' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time!: string | null;
}
