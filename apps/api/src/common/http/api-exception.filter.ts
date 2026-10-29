import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import { writeStructuredLog } from './json-logger';
import type { RequestWithContext } from './request-context';

interface ErrorBody {
  readonly code: string;
  readonly details: unknown;
  readonly message: string;
  readonly requestId: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = createErrorBody(exception, request.requestId, status);

    if (status >= 500) {
      writeStructuredLog('error', 'http.exception', {
        error: exception instanceof Error ? { name: exception.name, message: exception.message, stack: exception.stack } : exception,
        method: request.method,
        path: request.originalUrl,
        requestId: request.requestId,
        statusCode: status,
      });
    }
    response.status(status).json(body);
  }
}

function createErrorBody(exception: unknown, requestId: string, status: number): ErrorBody {
  if (!(exception instanceof HttpException)) {
    return { code: 'internal_error', details: null, message: 'Internal server error', requestId };
  }

  const response = exception.getResponse();
  if (typeof response === 'string') {
    return { code: statusCode(status), details: null, message: response, requestId };
  }
  const record = response as Record<string, unknown>;
  const rawMessage = record.message;
  const validationMessages = Array.isArray(rawMessage) ? rawMessage.filter((value): value is string => typeof value === 'string') : null;
  const message = validationMessages ? 'Request validation failed' :
    typeof rawMessage === 'string' ? rawMessage : exception.message;
  return {
    code: typeof record.code === 'string' ? record.code : statusCode(status),
    details: validationMessages ?? record.details ?? null,
    message,
    requestId,
  };
}

function statusCode(status: number): string {
  const names: Record<number, string> = {
    400: 'invalid_request',
    401: 'unauthorized',
    403: 'forbidden',
    404: 'not_found',
    409: 'conflict',
    413: 'payload_too_large',
    429: 'rate_limited',
    503: 'service_unavailable',
  };
  return names[status] ?? (status >= 500 ? 'internal_error' : `http_${status}`);
}
