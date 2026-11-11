import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class TripRegionDto {
  @ApiProperty({ type: String, maxLength: 255, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  googlePlaceId!: string | null;

  @ApiProperty({ type: String, maxLength: 120, example: '서울' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: String, maxLength: 300, nullable: true })
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
}
