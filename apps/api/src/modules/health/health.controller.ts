import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/domain/public.decorator';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

class HealthResponse {
  status!: 'ok';
}

@ApiTags('health')
@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  @Get()
  @ApiOkResponse({ type: HealthResponse })
  async getHealth(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database readiness check failed');
    }
    return { status: 'ok' };
  }

  @Get('live')
  @ApiOkResponse({ type: HealthResponse })
  getLiveness(): HealthResponse {
    return { status: 'ok' };
  }
}
