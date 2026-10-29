import { BadRequestException } from '@nestjs/common';

import { VisitStatus } from '../../itineraries/domain/entities/itinerary-item.entity';
import { CompleteTripItemDto } from './dto/complete-trip.dto';

export interface VisitResult {
  visitStatus: VisitStatus;
  rating: number | null;
  review: string | null;
}

export function resolveVisitResult(input?: CompleteTripItemDto): VisitResult {
  if (input?.notVisited && input.rating !== undefined) {
    throw new BadRequestException('A not-visited place cannot have a rating');
  }
  if (input?.notVisited) {
    return { visitStatus: VisitStatus.NotVisited, rating: null, review: input.review ?? null };
  }
  if (input?.rating !== undefined) {
    return { visitStatus: VisitStatus.Rated, rating: input.rating, review: input.review ?? null };
  }
  return { visitStatus: VisitStatus.Unrated, rating: null, review: input?.review ?? null };
}
