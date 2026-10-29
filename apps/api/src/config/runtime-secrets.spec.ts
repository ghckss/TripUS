import { describe, expect, it } from 'vitest';

import { loadRuntimeSecrets } from './runtime-secrets';

describe('loadRuntimeSecrets', () => {
  it('merges application secrets without overriding explicit environment values', async () => {
    const environment: NodeJS.ProcessEnv = {
      OPENAI_API_KEY: 'explicit-key',
      RUNTIME_SECRET_ARN: 'runtime-secret',
    };
    const reader = fakeReader({ OPENAI_API_KEY: 'secret-key', ACCESS_TOKEN_SECRET: 'generated-secret' });

    await loadRuntimeSecrets(environment, reader);

    expect(environment.OPENAI_API_KEY).toBe('explicit-key');
    expect(environment.ACCESS_TOKEN_SECRET).toBe('generated-secret');
  });

  it('builds an encoded PostgreSQL URL using the proxy endpoint', async () => {
    const environment: NodeJS.ProcessEnv = {
      DATABASE_NAME: 'trip us',
      DATABASE_PROXY_HOST: 'proxy.internal',
      DATABASE_SECRET_ARN: 'database-secret',
    };
    const reader = fakeReader({ host: 'writer.internal', port: 5432, username: 'trip@us', password: 'p:a/ss' });

    await loadRuntimeSecrets(environment, reader);

    expect(environment.DATABASE_URL).toBe(
      'postgresql://trip%40us:p%3Aa%2Fss@proxy.internal:5432/trip%20us?sslmode=require',
    );
  });
});

function fakeReader(secret: Record<string, unknown>) {
  return {
    send() {
      return Promise.resolve({ SecretString: JSON.stringify(secret) });
    },
  };
}
