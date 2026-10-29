import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import type { AuthenticatedRequest } from '../../auth/infrastructure/access-token.guard';
import type { IdentityPort } from '../domain/identity.port';

@Injectable({ scope: Scope.REQUEST })
export class RequestIdentityService implements IdentityPort {
  constructor(@Inject(REQUEST) private readonly request: AuthenticatedRequest) {}

  getCurrentUserId(): string {
    if (!this.request.userId) throw new UnauthorizedException('Authenticated user is missing');
    return this.request.userId;
  }
}
