import type { App } from 'aws-cdk-lib';

export interface StageConfig {
  readonly aiPlannerProvider: 'mock' | 'openai';
  readonly applicationDatabaseRotation: boolean;
  readonly authMode: 'development' | 'jwt';
  readonly mapsProvider: 'google' | 'mock';
  readonly maxApiEnvironments: number;
  readonly maxApiRequestsPerSecond: number;
  readonly production: boolean;
  readonly stage: string;
}

export function loadStageConfig(app: App): StageConfig {
  const stage = contextString(app, 'stage', 'dev');
  const production = stage === 'prod';

  return {
    aiPlannerProvider: contextProvider(app, 'aiPlannerProvider', production ? 'openai' : 'mock', ['mock', 'openai']),
    applicationDatabaseRotation: contextBoolean(app, 'applicationDatabaseRotation', false),
    authMode: contextProvider(app, 'authMode', production ? 'jwt' : 'development', ['development', 'jwt']),
    mapsProvider: contextProvider(app, 'mapsProvider', production ? 'google' : 'mock', ['mock', 'google']),
    maxApiEnvironments: contextInteger(app, 'maxApiEnvironments', production ? 20 : 2),
    maxApiRequestsPerSecond: contextInteger(app, 'maxApiRequestsPerSecond', production ? 1000 : 100),
    production,
    stage,
  };
}

function contextBoolean(app: App, key: string, fallback: boolean): boolean {
  const value: unknown = app.node.tryGetContext(key);
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`CDK context ${key} must be true or false`);
}

function contextString(app: App, key: string, fallback: string): string {
  const value: unknown = app.node.tryGetContext(key);
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length === 0) throw new Error(`CDK context ${key} must be a non-empty string`);
  return value;
}

function contextInteger(app: App, key: string, fallback: number): number {
  const value: unknown = app.node.tryGetContext(key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`CDK context ${key} must be a positive integer`);
  return parsed;
}

function contextProvider<T extends string>(app: App, key: string, fallback: T, allowed: readonly T[]): T {
  const value = contextString(app, key, fallback);
  if (!allowed.includes(value as T)) throw new Error(`CDK context ${key} must be one of ${allowed.join(', ')}`);
  return value as T;
}
