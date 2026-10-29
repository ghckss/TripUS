import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/domain/public.decorator';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

class HealthResponse {
  status!: 'ok';
}

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse })
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
