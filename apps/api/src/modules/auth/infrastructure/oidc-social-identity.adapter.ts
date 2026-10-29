import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { SocialAuthProvider } from '../domain/entities/auth-identity.entity';
import { SocialIdentityPort, VerifiedSocialIdentity } from '../domain/social-identity.port';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

@Injectable()
export class OidcSocialIdentityAdapter implements SocialIdentityPort {
  private readonly audiences: Record<SocialAuthProvider, string[]>;

  constructor(config: ConfigService) {
    this.audiences = {
      [SocialAuthProvider.Google]: splitClientIds(config.get<string>('GOOGLE_OIDC_CLIENT_IDS')),
      [SocialAuthProvider.Apple]: splitClientIds(config.get<string>('APPLE_OIDC_CLIENT_IDS')),
    };
  }

  async verify(provider: SocialAuthProvider, idToken: string): Promise<VerifiedSocialIdentity> {
    const audience = this.audiences[provider];
    if (audience.length === 0) throw new UnauthorizedException(`${provider} login is not configured`);
    try {
      const result = provider === SocialAuthProvider.Google
        ? await jwtVerify(idToken, googleKeys, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience })
        : await jwtVerify(idToken, appleKeys, { issuer: 'https://appleid.apple.com', audience });
      return claimsToIdentity(result.payload);
    } catch {
      throw new UnauthorizedException('Invalid social identity token');
    }
  }
}

function splitClientIds(value?: string): string[] {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
}

function claimsToIdentity(payload: JWTPayload): VerifiedSocialIdentity {
  if (!payload.sub) throw new UnauthorizedException('Identity token subject is missing');
  return {
    subject: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    displayName: typeof payload.name === 'string' ? payload.name : null,
  };
}
