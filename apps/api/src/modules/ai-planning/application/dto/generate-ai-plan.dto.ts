import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { ItineraryResponseDto } from '../../../itineraries/application/dto/itinerary.dto';
import { TravelStyle } from '../../domain/ai-planner.port';

export enum AiTransportMode {
  PublicTransit = 'public_transit',
  Walking = 'walking',
  Car = 'car',
  Mixed = 'mixed',
}

export enum AiBudgetLevel {
  Budget = 'budget',
  Standard = 'standard',
  Premium = 'premium',
}

export class GenerateAiPlanDto {
  @ApiProperty({ enum: TravelStyle, enumName: 'TravelStyle' })
  @IsEnum(TravelStyle)
  style!: TravelStyle;

  @ApiPropertyOptional({ type: String, maxLength: 120, example: '친구 2명' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companions?: string;

  @ApiPropertyOptional({ enum: AiTransportMode, enumName: 'AiTransportMode' })
  @IsOptional()
  @IsEnum(AiTransportMode)
  transportMode?: AiTransportMode;

  @ApiPropertyOptional({ enum: AiBudgetLevel, enumName: 'AiBudgetLevel' })
  @IsOptional()
  @IsEnum(AiBudgetLevel)
  budgetLevel?: AiBudgetLevel;

  @ApiPropertyOptional({ type: String, maxLength: 500, example: '현지 맛집과 전시를 좋아함' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  preferences?: string;

  @ApiPropertyOptional({ type: String, maxLength: 500, example: '긴 대기와 하루 1만 보 이상 걷기' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avoidances?: string;
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

export class LatestAiPlanRequestResponseDto {
  @ApiPropertyOptional({ type: GenerateAiPlanDto, nullable: true })
  request!: GenerateAiPlanDto | null;
}
