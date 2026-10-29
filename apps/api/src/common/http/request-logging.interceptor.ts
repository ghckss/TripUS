import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs';

import { writeStructuredLog } from './json-logger';
import type { RequestWithContext } from './request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = performance.now();

    return next.handle().pipe(finalize(() => {
      writeStructuredLog(response.statusCode >= 500 ? 'error' : 'info', 'http.request', {
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        method: request.method,
        path: request.originalUrl,
        requestId: request.requestId,
        statusCode: response.statusCode,
        ...(request.userId ? { userId: request.userId } : {}),
      });
    }));
  }
}
