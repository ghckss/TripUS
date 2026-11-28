import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { ItineraryResponseDto } from '../../../itineraries/application/dto/itinerary.dto';

export class GenerateAiPlanDto {
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

export class StartAiPlanGenerationResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  generationId!: string;

  @ApiProperty({ enum: AiPlanExecutionStatus, enumName: 'AiPlanExecutionStatus' })
  status!: AiPlanExecutionStatus;
}

export class AiPlanExecutionStatusResponseDto {
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  generationId!: string | null;

  @ApiProperty({ enum: AiPlanExecutionStatus, enumName: 'AiPlanExecutionStatus' })
  status!: AiPlanExecutionStatus;

  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason!: string | null;
}
