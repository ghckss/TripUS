import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsDateString, IsObject, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductEventDto {
  @ApiProperty({ example: 'trip.created', maxLength: 80, pattern: '^[a-z][a-z0-9_.-]+$', type: String })
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_.-]+$/)
  name!: string;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ required: false, type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  properties?: Record<string, boolean | number | string | null>;
}

export class IngestEventsDto {
  @ApiProperty({ type: ProductEventDto, isArray: true, maxItems: 20 })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductEventDto)
  events!: ProductEventDto[];
}
