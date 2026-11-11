import { Body, Controller, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { AiPlanningService } from '../application/ai-planning.service';
import { GenerateAiPlanDto, GenerateAiPlanResponseDto } from '../application/dto/generate-ai-plan.dto';

@ApiTags('ai-planning')
@Controller('trips/:tripId/ai-plans')
export class AiPlanningController {
  constructor(@Inject(AiPlanningService) private readonly planning: AiPlanningService) {}

  @Post()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: GenerateAiPlanDto })
  @ApiOkResponse({ type: GenerateAiPlanResponseDto })
  generate(@Param('tripId', new ParseUUIDPipe()) tripId: string, @Body() input: GenerateAiPlanDto): Promise<GenerateAiPlanResponseDto> {
    return this.planning.generate(tripId, input);
  }
}
