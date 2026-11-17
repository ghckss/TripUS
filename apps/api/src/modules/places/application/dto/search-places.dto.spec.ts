import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { SearchPlacesInMapQueryDto } from './search-places.dto';

const pipe = new ValidationPipe({ expectedType: SearchPlacesInMapQueryDto, transform: true, whitelist: true, forbidNonWhitelisted: true });

describe('map search query validation', () => {
  it('converts HTTP query string coordinates without emitted runtime parameter types', async () => {
    const result: unknown = await pipe.transform({ query: '카페', north: '38', south: '37', west: '126', east: '128' }, { type: 'query' });
    expect(result).toMatchObject({ query: '카페', north: 38, south: 37, west: 126, east: 128 });
  });

  it.each(['NaN', 'Infinity', '91', 'text'])('rejects invalid latitude %s', async (north) => {
    await expect(pipe.transform({ query: '카페', north, south: '37', west: '126', east: '128' }, { type: 'query' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
