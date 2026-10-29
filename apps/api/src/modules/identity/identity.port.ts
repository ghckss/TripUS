export const IDENTITY_PORT = Symbol('IDENTITY_PORT');

export interface IdentityPort {
  getCurrentUserId(): string;
}
