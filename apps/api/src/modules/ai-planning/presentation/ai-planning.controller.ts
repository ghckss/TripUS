import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { AiPlanningService } from '../application/ai-planning.service';
import {
  AiPlanExecutionStatusResponseDto,
  GenerateAiPlanDto,
  GenerateAiPlanResponseDto,
  LatestAiPlanRequestResponseDto,
} from '../application/dto/generate-ai-plan.dto';

@ApiTags('ai-planning')
@Controller('trips/:tripId/ai-plans')
export class AiPlanningController {
  constructor(@Inject(AiPlanningService) private readonly planning: AiPlanningService) {}

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
    return this.planning.getStatus(tripId);
  }

  @Post()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: GenerateAiPlanDto })
  @ApiOkResponse({ type: GenerateAiPlanResponseDto })
  generate(@Param('tripId', new ParseUUIDPipe()) tripId: string, @Body() input: GenerateAiPlanDto): Promise<GenerateAiPlanResponseDto> {
    return this.planning.generate(tripId, input);
  }

  @Post('days/:date')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiParam({ name: 'date', type: String, format: 'date' })
  @ApiOkResponse({ type: GenerateAiPlanResponseDto })
  generateDay(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('date') date: string,
  ): Promise<GenerateAiPlanResponseDto> {
    return this.planning.generateDay(tripId, date);
  }
}
