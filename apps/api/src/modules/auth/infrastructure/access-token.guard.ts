import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';

import { AuthMode } from '../../../config/environment';
import { DEVELOPMENT_USER_ID } from '../../identity/infrastructure/development-identity.service';
import { IS_PUBLIC_ROUTE } from '../domain/public.decorator';

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  userId?: string;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization && this.config.get<string>('AUTH_MODE') === AuthMode.Development) {
      request.userId = DEVELOPMENT_USER_ID;
      return true;
    }
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer token is required');
    try {
      const payload = verify(authorization.slice(7), this.config.getOrThrow<string>('ACCESS_TOKEN_SECRET'), {
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('ACCESS_TOKEN_ISSUER'),
        audience: this.config.getOrThrow<string>('ACCESS_TOKEN_AUDIENCE'),
      });
      if (typeof payload === 'string' || !payload.sub) throw new UnauthorizedException();
      request.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }
}
