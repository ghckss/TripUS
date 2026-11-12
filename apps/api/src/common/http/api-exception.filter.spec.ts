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
      code: 'VALIDATION_FAILED',
      details: null,
      requestId: 'request-1',
    });
  });

  it('returns a UPPER_SNAKE_CASE code without exposing the server message', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const response = { status } as unknown as Response;
    const request = { method: 'GET', originalUrl: '/v1/trips/missing', requestId: 'request-2' } as RequestWithContext;
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new BadRequestException('Trip not found'), host);

    expect(json).toHaveBeenCalledWith({
      code: 'TRIP_NOT_FOUND',
      details: null,
      requestId: 'request-2',
    });
  });
});
