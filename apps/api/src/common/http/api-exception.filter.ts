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
    return { code: 'INTERNAL_ERROR', details: null, requestId };
  }

  const response = exception.getResponse();
  if (typeof response === 'string') {
    return { code: errorCode(response, status), details: null, requestId };
  }
  const record = response as Record<string, unknown>;
  const rawMessage = record.message;
  const isValidationError = Array.isArray(rawMessage);
  return {
    code: typeof record.code === 'string'
      ? normalizeErrorCode(record.code)
      : isValidationError
        ? 'VALIDATION_FAILED'
        : errorCode(typeof rawMessage === 'string' ? rawMessage : exception.message, status),
    details: isValidationError ? null : record.details ?? null,
    requestId,
  };
}

function normalizeErrorCode(code: string): string {
  return code
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'INTERNAL_ERROR';
}

function statusCode(status: number): string {
  const names: Record<number, string> = {
    400: 'INVALID_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    429: 'RATE_LIMITED',
    503: 'SERVICE_UNAVAILABLE',
  };
  return names[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`);
}

function errorCode(message: string, status: number): string {
  const exactCodes: Record<string, string> = {
    'A not-visited place cannot have a rating': 'NOT_VISITED_RATING_NOT_ALLOWED',
    'Access token is invalid or expired': 'ACCESS_TOKEN_INVALID',
    'AI planning supports at most 100 saved places': 'AI_PLACE_LIMIT_EXCEEDED',
    'Authenticated user is missing': 'AUTHENTICATION_REQUIRED',
    'Authenticated user is unavailable': 'AUTHENTICATION_REQUIRED',
    'Bearer token is required': 'AUTHENTICATION_REQUIRED',
    'Database readiness check failed': 'DATABASE_UNAVAILABLE',
    'Development login is disabled': 'DEVELOPMENT_LOGIN_DISABLED',
    'Development user is unavailable': 'DEVELOPMENT_USER_UNAVAILABLE',
    'Duplicate itinerary item': 'DUPLICATE_ITINERARY_ITEM',
    'Duplicate trip region': 'DUPLICATE_TRIP_REGION',
    'endDate must be on or after startDate': 'INVALID_TRIP_DATE_RANGE',
    'Identity token subject is missing': 'INVALID_SOCIAL_IDENTITY',
    'Invalid social identity token': 'INVALID_SOCIAL_IDENTITY',
    'Itinerary item does not belong to trip': 'ITINERARY_ITEM_TRIP_MISMATCH',
    'Itinerary item not found': 'ITINERARY_ITEM_NOT_FOUND',
    'One or more saved places were not found': 'SAVED_PLACES_NOT_FOUND',
    'Photo content type does not match': 'PHOTO_CONTENT_TYPE_MISMATCH',
    'Photo could not be processed': 'PHOTO_PROCESSING_FAILED',
    'Photo exceeds the 100 MB per-file limit': 'PHOTO_TOO_LARGE',
    'Photo not found': 'PHOTO_NOT_FOUND',
    'Photo upload is already finalized': 'PHOTO_ALREADY_FINALIZED',
    'Photo variant not found': 'PHOTO_VARIANT_NOT_FOUND',
    'Refresh token is invalid or expired': 'REFRESH_TOKEN_INVALID',
    'Refresh token user is unavailable': 'REFRESH_TOKEN_USER_UNAVAILABLE',
    'Region coordinates must include both latitude and longitude': 'INVALID_REGION_COORDINATES',
    'Region name must not be empty': 'INVALID_REGION_NAME',
    'Saved place not found': 'SAVED_PLACE_NOT_FOUND',
    'Trip not found': 'TRIP_NOT_FOUND',
    'Try AI planning again in a minute': 'AI_PLANNING_RATE_LIMITED',
    '무료 AI 일정 생성 1회를 모두 사용했어요. Plus에서 AI 일정을 더 만들 수 있어요.': 'AI_GENERATION_LIMIT_REACHED',
    '무료 플랜에서는 활성·보관 여행을 합쳐 1개까지 만들 수 있어요. 기존 여행을 삭제하거나 Plus를 이용해 주세요.': 'TRIP_LIMIT_REACHED',
  };
  if (exactCodes[message]) return exactCodes[message];
  if (/ login is not configured$/.test(message)) return 'SOCIAL_LOGIN_NOT_CONFIGURED';
  if (message.startsWith('Google Place')) return 'PLACE_PROVIDER_UNAVAILABLE';
  if (message.startsWith('Google Routes')) return 'ROUTE_PROVIDER_UNAVAILABLE';
  return statusCode(status);
}
