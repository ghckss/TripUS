import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { ItineraryUpdateResultDto } from '../../../itineraries/application/dto/itinerary.dto';
import { TravelStyle } from '../../domain/ai-planner.port';

export class GenerateAiPlanDto {
  @ApiProperty({ enum: TravelStyle, enumName: 'TravelStyle' })
  @IsEnum(TravelStyle)
  style!: TravelStyle;
}

export class GenerateAiPlanResponseDto extends ItineraryUpdateResultDto {
  @ApiProperty({ enum: TravelStyle, enumName: 'TravelStyle' })
  style!: TravelStyle;
}
