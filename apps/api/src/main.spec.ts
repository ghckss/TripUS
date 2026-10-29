import { describe, expect, it } from 'vitest';

import { resolveHttpEndpoint } from './config/http-endpoint';

describe('resolveHttpEndpoint', () => {
  it('uses the Lambda Web Function endpoint when present', () => {
    expect(resolveHttpEndpoint({ AWS_LAMBDA_HTTP_ENDPOINT: '127.0.0.1:8080' })).toEqual({
      host: '127.0.0.1',
      port: 8080,
    });
  });

  it('keeps the local development endpoint as the fallback', () => {
    expect(resolveHttpEndpoint({ PORT: '3100' })).toEqual({ host: '0.0.0.0', port: 3100 });
  });
});
