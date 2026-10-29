import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ApiExceptionFilter } from './api-exception.filter';
import type { RequestWithContext } from './request-context';

describe('ApiExceptionFilter', () => {
  it('returns the standard validation error contract with request ID', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status } as unknown as Response;
    const request = { method: 'POST', originalUrl: '/v1/trips', requestId: 'request-1' } as RequestWithContext;
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new BadRequestException(['name must be a string']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      code: 'invalid_request',
      details: ['name must be a string'],
      message: 'Request validation failed',
      requestId: 'request-1',
    });
  });
});
