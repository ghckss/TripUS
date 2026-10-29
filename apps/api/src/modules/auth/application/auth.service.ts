import { createHash, randomBytes } from 'node:crypto';

import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import { DataSource, EntityManager, IsNull, MoreThan, Repository } from 'typeorm';

import { AuthMode } from '../../../config/environment';
import { DEVELOPMENT_USER_ID } from '../../identity/infrastructure/development-identity.service';
import { UserEntity } from '../../users/domain/entities/user.entity';
import { AuthIdentityEntity } from '../domain/entities/auth-identity.entity';
import { RefreshTokenEntity } from '../domain/entities/refresh-token.entity';
import { SOCIAL_IDENTITY_PORT, type SocialIdentityPort } from '../domain/social-identity.port';
import { AuthSessionDto, RefreshSessionDto, SocialLoginDto } from './dto/auth.dto';

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthIdentityEntity) private readonly identities: Repository<AuthIdentityEntity>,
    @InjectRepository(RefreshTokenEntity) private readonly refreshTokens: Repository<RefreshTokenEntity>,
    @Inject(SOCIAL_IDENTITY_PORT) private readonly socialIdentity: SocialIdentityPort,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {}

  async socialLogin(input: SocialLoginDto): Promise<AuthSessionDto> {
    const verified = await this.socialIdentity.verify(input.provider, input.idToken);
    let identity = await this.identities.findOne({
      where: { provider: input.provider, subject: verified.subject },
      relations: { user: true },
    });
    if (!identity) {
      identity = await this.dataSource.transaction(async (manager) => {
        const email = verified.email ?? `${input.provider}-${verified.subject}@identity.tripus.invalid`;
        let user = await manager.findOneBy(UserEntity, { email });
        if (!user) {
          user = await manager.save(UserEntity, manager.create(UserEntity, {
            email,
            displayName: input.displayName ?? verified.displayName ?? '여행자',
          }));
        }
        return manager.save(AuthIdentityEntity, manager.create(AuthIdentityEntity, {
          userId: user.id,
          user,
          provider: input.provider,
          subject: verified.subject,
        }));
      });
    }
    return this.issueSession(identity.user);
  }

  async developmentLogin(): Promise<AuthSessionDto> {
    if (this.config.get<string>('AUTH_MODE') !== AuthMode.Development) {
      throw new ForbiddenException('Development login is disabled');
    }
    const user = await this.users.findOneBy({ id: DEVELOPMENT_USER_ID });
    if (!user) throw new UnauthorizedException('Development user is unavailable');
    return this.issueSession(user);
  }

  async refresh(input: RefreshSessionDto): Promise<AuthSessionDto> {
    return this.dataSource.transaction(async (manager) => {
      const token = await manager.findOne(RefreshTokenEntity, {
        where: { tokenHash: hashToken(input.refreshToken), revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!token) throw new UnauthorizedException('Refresh token is invalid or expired');
      const user = await manager.findOneBy(UserEntity, { id: token.userId });
      if (!user) throw new UnauthorizedException('Refresh token user is unavailable');
      const next = await this.createRefreshToken(token.userId, manager);
      token.revokedAt = new Date();
      token.replacedByTokenId = next.entity.id;
      await manager.save(RefreshTokenEntity, token);
      return this.sessionResponse(user, next.raw);
    });
  }

  async logout(input: RefreshSessionDto): Promise<void> {
    const token = await this.refreshTokens.findOneBy({ tokenHash: hashToken(input.refreshToken) });
    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      await this.refreshTokens.save(token);
    }
  }

  private async issueSession(user: UserEntity): Promise<AuthSessionDto> {
    const refresh = await this.createRefreshToken(user.id);
    return this.sessionResponse(user, refresh.raw);
  }

  private async createRefreshToken(userId: string, manager?: EntityManager): Promise<{ raw: string; entity: RefreshTokenEntity }> {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + REFRESH_TOKEN_DAYS);
    const repository = manager?.getRepository(RefreshTokenEntity) ?? this.refreshTokens;
    const entity = await repository.save(repository.create({
      userId,
      tokenHash: hashToken(raw),
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
    }));
    return { raw, entity };
  }

  private sessionResponse(user: UserEntity, refreshToken: string): AuthSessionDto {
    const accessToken = sign({}, this.config.getOrThrow<string>('ACCESS_TOKEN_SECRET'), {
      subject: user.id,
      issuer: this.config.getOrThrow<string>('ACCESS_TOKEN_ISSUER'),
      audience: this.config.getOrThrow<string>('ACCESS_TOKEN_AUDIENCE'),
      expiresIn: ACCESS_TOKEN_SECONDS,
    });
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: ACCESS_TOKEN_SECONDS,
      user: { id: user.id, email: user.email, displayName: user.displayName },
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
