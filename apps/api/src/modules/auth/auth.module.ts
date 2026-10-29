import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../users/domain/entities/user.entity';
import { AuthService } from './application/auth.service';
import { AuthIdentityEntity } from './domain/entities/auth-identity.entity';
import { RefreshTokenEntity } from './domain/entities/refresh-token.entity';
import { SOCIAL_IDENTITY_PORT } from './domain/social-identity.port';
import { AccessTokenGuard } from './infrastructure/access-token.guard';
import { OidcSocialIdentityAdapter } from './infrastructure/oidc-social-identity.adapter';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AuthIdentityEntity, RefreshTokenEntity])],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: SOCIAL_IDENTITY_PORT, inject: [ConfigService], useFactory: (config: ConfigService) => new OidcSocialIdentityAdapter(config) },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
})
export class AuthModule {}
