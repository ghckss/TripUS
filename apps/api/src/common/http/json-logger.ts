import type { LoggerService } from '@nestjs/common';

type LogLevel = 'debug' | 'error' | 'fatal' | 'info' | 'warn';

export class JsonLogger implements LoggerService {
  debug(message: unknown, ...optionalParams: unknown[]): void {
    writeStructuredLog('debug', 'application.log', { message: normalize(message), ...parseOptional(optionalParams) });
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    writeStructuredLog('error', 'application.error', { message: normalize(message), ...parseOptional(optionalParams) });
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    writeStructuredLog('fatal', 'application.fatal', { message: normalize(message), ...parseOptional(optionalParams) });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    writeStructuredLog('info', 'application.log', { message: normalize(message), ...parseOptional(optionalParams) });
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    writeStructuredLog('debug', 'application.verbose', { message: normalize(message), ...parseOptional(optionalParams) });
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    writeStructuredLog('warn', 'application.warn', { message: normalize(message), ...parseOptional(optionalParams) });
  }
}

export function writeStructuredLog(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields });
  const output = level === 'error' || level === 'fatal' ? process.stderr : process.stdout;
  output.write(`${line}\n`);
}

function normalize(value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  return value;
}

function parseOptional(values: unknown[]): Record<string, unknown> {
  if (values.length === 0) return {};
  const context = typeof values.at(-1) === 'string' ? values.at(-1) : undefined;
  return {
    ...(context ? { context } : {}),
    parameters: values.map(normalize),
  };
}
