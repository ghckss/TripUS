import { describe, expect, it } from 'vitest';

import { BillingProvider, validateEnvironment } from './environment';

describe('validateEnvironment', () => {
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
