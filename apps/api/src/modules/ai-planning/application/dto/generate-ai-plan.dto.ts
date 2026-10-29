import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ItineraryResponseDto } from '../../../itineraries/application/dto/itinerary.dto';
import { TravelStyle } from '../../domain/ai-planner.port';

export class GenerateAiPlanDto {
  @ApiProperty({ enum: TravelStyle, enumName: 'TravelStyle' })
  @IsEnum(TravelStyle)
  style!: TravelStyle;
}

export enum AiPlanGenerationStatus {
  Generated = 'generated',
  Conflict = 'conflict',
  Unavailable = 'unavailable',
}

export class GenerateAiPlanResponseDto {
  @ApiProperty({ enum: AiPlanGenerationStatus, enumName: 'AiPlanGenerationStatus' })
  status!: AiPlanGenerationStatus;

  @ApiProperty({ enum: TravelStyle, enumName: 'TravelStyle' })
  style!: TravelStyle;

  @ApiProperty({ type: String, isArray: true })
  conflicts!: string[];

  @ApiProperty({ type: ItineraryResponseDto })
  itinerary!: ItineraryResponseDto;

  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason!: string | null;
}
