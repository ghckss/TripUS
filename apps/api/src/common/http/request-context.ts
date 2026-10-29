import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export interface RequestWithContext extends Request {
  requestId: string;
  userId?: string;
}

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestContextMiddleware(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.header('x-request-id');
  const requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
  (request as RequestWithContext).requestId = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}
