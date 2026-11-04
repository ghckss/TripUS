import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { EntitlementsService } from '../application/entitlements.service';
import { EntitlementsResponseDto } from '../application/dto/entitlements-response.dto';

@ApiTags('entitlements')
@Controller('me/entitlements')
export class EntitlementsController {
  constructor(@Inject(EntitlementsService) private readonly entitlements: EntitlementsService) {}

  @Get()
  @ApiOkResponse({ type: EntitlementsResponseDto })
  get(): Promise<EntitlementsResponseDto> {
    return this.entitlements.get();
  }
}
