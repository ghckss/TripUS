import { describe, expect, it } from 'vitest';

import { BillingProvider, validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('allows long web-backed generation without automatic duplicate requests by default', () => {
    expect(validateEnvironment({})).toMatchObject({ OPENAI_TIMEOUT_MS: 600_000, OPENAI_MAX_RETRIES: 0, OPENAI_MAX_OUTPUT_TOKENS: 64_000 });
    expect(validateEnvironment({ OPENAI_TIMEOUT_MS: '900000', OPENAI_MAX_RETRIES: '1' })).toMatchObject({ OPENAI_TIMEOUT_MS: 900_000, OPENAI_MAX_RETRIES: 1 });
  });
  it('keeps plan upgrades disabled unless mock billing is explicitly selected', () => {
    expect(validateEnvironment({}).BILLING_PROVIDER).toBe(BillingProvider.Disabled);
    expect(validateEnvironment({ BILLING_PROVIDER: BillingProvider.Mock }).BILLING_PROVIDER).toBe(BillingProvider.Mock);
  });

  it('rejects unsupported billing providers', () => {
    expect(() => validateEnvironment({ BILLING_PROVIDER: 'store' })).toThrow(
      'BILLING_PROVIDER must be disabled or mock',
    );
  });

  it('never enables mock upgrades in production', () => {
    expect(() => validateEnvironment({ BILLING_PROVIDER: BillingProvider.Mock, NODE_ENV: 'production' })).toThrow(
      'BILLING_PROVIDER=mock is not allowed in production',
    );
  });
});
