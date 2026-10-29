import { SocialAuthProvider } from './entities/auth-identity.entity';

export const SOCIAL_IDENTITY_PORT = Symbol('SOCIAL_IDENTITY_PORT');

export interface VerifiedSocialIdentity {
  subject: string;
  email: string | null;
  displayName: string | null;
}

export interface SocialIdentityPort {
  verify(provider: SocialAuthProvider, idToken: string): Promise<VerifiedSocialIdentity>;
}
