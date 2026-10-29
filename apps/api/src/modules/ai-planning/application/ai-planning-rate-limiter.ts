import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

@Injectable()
export class AiPlanningRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  assertAllowed(userId: string, now = Date.now()): void {
    const recent = (this.attempts.get(userId) ?? []).filter((timestamp) => timestamp > now - WINDOW_MS);
    if (recent.length >= MAX_REQUESTS) throw new HttpException('Try AI planning again in a minute', HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    this.attempts.set(userId, recent);
  }
}
