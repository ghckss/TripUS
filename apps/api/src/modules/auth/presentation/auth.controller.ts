import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { ApiBody, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { AuthService } from '../application/auth.service';
import { AuthSessionDto, RefreshSessionDto, SocialLoginDto } from '../application/dto/auth.dto';
import { Public } from '../domain/public.decorator';

@Public()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('social')
  @HttpCode(200)
  @ApiBody({ type: SocialLoginDto })
  @ApiOkResponse({ type: AuthSessionDto })
  social(@Body() input: SocialLoginDto): Promise<AuthSessionDto> {
    return this.auth.socialLogin(input);
  }

  @Post('development')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthSessionDto })
  development(): Promise<AuthSessionDto> {
    return this.auth.developmentLogin();
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiBody({ type: RefreshSessionDto })
  @ApiOkResponse({ type: AuthSessionDto })
  refresh(@Body() input: RefreshSessionDto): Promise<AuthSessionDto> {
    return this.auth.refresh(input);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBody({ type: RefreshSessionDto })
  @ApiNoContentResponse()
  async logout(@Body() input: RefreshSessionDto): Promise<void> {
    await this.auth.logout(input);
  }
}
