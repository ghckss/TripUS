import { Controller, Delete, HttpCode, Inject } from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';

import { IDENTITY_PORT, type IdentityPort } from '../../identity/domain/identity.port';
import { AuthService } from '../application/auth.service';

@ApiTags('account')
@Controller('account')
export class AccountController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(IDENTITY_PORT) private readonly identity: IdentityPort,
  ) {}

  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse()
  async delete(): Promise<void> {
    await this.auth.deleteAccount(this.identity.getCurrentUserId());
  }
}
