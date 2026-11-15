import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { AiPlanningService } from '../application/ai-planning.service';
import { AiPlanningJobsService } from '../application/ai-planning-jobs.service';
import {
  AiPlanExecutionStatusResponseDto,
  GenerateAiPlanDto,
  LatestAiPlanRequestResponseDto,
  StartAiPlanGenerationResponseDto,
} from '../application/dto/generate-ai-plan.dto';

@ApiTags('ai-planning')
@Controller('trips/:tripId/ai-plans')
export class AiPlanningController {
  constructor(
    @Inject(AiPlanningService) private readonly planning: AiPlanningService,
    @Inject(AiPlanningJobsService) private readonly jobs: AiPlanningJobsService,
  ) {}

  @Get('latest-request')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: LatestAiPlanRequestResponseDto })
  getLatestRequest(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<LatestAiPlanRequestResponseDto> {
    return this.planning.getLatestRequest(tripId);
  }

  @Get('status')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: AiPlanExecutionStatusResponseDto })
  getStatus(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ): Promise<AiPlanExecutionStatusResponseDto> {
    return this.jobs.getStatus(tripId);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: GenerateAiPlanDto })
  @ApiAcceptedResponse({ type: StartAiPlanGenerationResponseDto })
  generate(@Param('tripId', new ParseUUIDPipe()) tripId: string, @Body() input: GenerateAiPlanDto): Promise<StartAiPlanGenerationResponseDto> {
    return this.jobs.start(tripId, input);
  }

  @Post('days/:date')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiParam({ name: 'date', type: String, format: 'date' })
  @ApiAcceptedResponse({ type: StartAiPlanGenerationResponseDto })
  generateDay(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('date') date: string,
  ): Promise<StartAiPlanGenerationResponseDto> {
    return this.jobs.startDay(tripId, date);
  }
}
