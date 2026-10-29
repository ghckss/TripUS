import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { requestContextMiddleware, type RequestWithContext } from './request-context';

describe('requestContextMiddleware', () => {
  it('preserves a safe caller request ID and returns it in the response', () => {
    const request = { header: vi.fn(() => 'mobile-request-123') } as unknown as Request;
    const setHeader = vi.fn();
    const response = { setHeader } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestContextMiddleware(request, response, next);

    expect((request as RequestWithContext).requestId).toBe('mobile-request-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'mobile-request-123');
    expect(next).toHaveBeenCalledOnce();
  });

  it('replaces unsafe request IDs', () => {
    const request = { header: vi.fn(() => 'bad request id\nvalue') } as unknown as Request;
    const response = { setHeader: vi.fn() } as unknown as Response;

    requestContextMiddleware(request, response, vi.fn());

    expect((request as RequestWithContext).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
