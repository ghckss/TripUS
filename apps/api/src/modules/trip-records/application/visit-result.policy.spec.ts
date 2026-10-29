import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { VisitStatus } from '../../itineraries/domain/entities/itinerary-item.entity';
import { resolveVisitResult } from './visit-result.policy';

describe('resolveVisitResult', () => {
  it('classifies an omitted result as unrated', () => {
    expect(resolveVisitResult()).toEqual({ visitStatus: VisitStatus.Unrated, rating: null, review: null });
  });

  it('classifies rating and not-visited independently', () => {
    expect(resolveVisitResult({ itineraryItemId: 'id', rating: 5 }).visitStatus).toBe(VisitStatus.Rated);
    expect(resolveVisitResult({ itineraryItemId: 'id', notVisited: true }).visitStatus).toBe(VisitStatus.NotVisited);
  });

  it('rejects rating a not-visited place', () => {
    expect(() => resolveVisitResult({ itineraryItemId: 'id', notVisited: true, rating: 3 })).toThrow(BadRequestException);
  });
});
