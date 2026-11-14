import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { ItineraryResponseDto } from '../../../itineraries/application/dto/itinerary.dto';
import { TravelDensity, TravelTheme } from '../../domain/ai-planner.port';

export enum AiTransportMode {
  PublicTransit = 'public_transit',
  Walking = 'walking',
  Car = 'car',
}

export enum AiBudgetLevel {
  Budget = 'budget',
  Standard = 'standard',
  Premium = 'premium',
}

export class GenerateAiPlanDto {
  @ApiProperty({ enum: TravelDensity, enumName: 'TravelDensity' })
  @IsEnum(TravelDensity)
  density!: TravelDensity;

  @ApiProperty({ enum: TravelTheme, enumName: 'TravelTheme', isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(TravelTheme, { each: true })
  themes!: TravelTheme[];

  @ApiPropertyOptional({ type: String, maxLength: 120, example: '친구 2명' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  companions?: string;

  @ApiProperty({ enum: AiTransportMode, enumName: 'AiTransportMode', isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(AiTransportMode, { each: true })
  transportModes!: AiTransportMode[];

  @ApiPropertyOptional({ enum: AiBudgetLevel, enumName: 'AiBudgetLevel' })
  @IsOptional()
  @IsEnum(AiBudgetLevel)
  budgetLevel?: AiBudgetLevel;

  @ApiPropertyOptional({ type: String, maxLength: 1000, example: '현지 맛집을 좋아하고 긴 대기와 이른 아침 일정은 피하고 싶어요.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  additionalRequests?: string;
}

export enum AiPlanGenerationStatus {
  Generated = 'generated',
  Conflict = 'conflict',
  Unavailable = 'unavailable',
}

export class GenerateAiPlanResponseDto {
  @ApiProperty({ enum: AiPlanGenerationStatus, enumName: 'AiPlanGenerationStatus' })
  status!: AiPlanGenerationStatus;

  @ApiProperty({ enum: TravelDensity, enumName: 'TravelDensity' })
  density!: TravelDensity;

  @ApiProperty({ enum: TravelTheme, enumName: 'TravelTheme', isArray: true })
  themes!: TravelTheme[];

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

export enum AiPlanExecutionStatus {
  Idle = 'idle',
  Running = 'running',
  Generated = 'generated',
  Conflict = 'conflict',
  Unavailable = 'unavailable',
}

export class AiPlanExecutionStatusResponseDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  generationId!: string | null;

  @ApiProperty({ enum: AiPlanExecutionStatus, enumName: 'AiPlanExecutionStatus' })
  status!: AiPlanExecutionStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason!: string | null;
}
