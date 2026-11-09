import { describe, expect, it } from 'vitest';

import { addLodgingEndpoints } from './ai-planning.service';

describe('addLodgingEndpoints', () => {
  it('wraps every trip day with the primary lodging', () => {
    const result = addLodgingEndpoints([
      { savedPlaceId: 'place-1', date: '2026-11-08', position: 0, locked: false },
    ], 'lodging-1', ['2026-11-08', '2026-11-09']);

    expect(result).toEqual([
      { savedPlaceId: 'lodging-1', date: '2026-11-08', position: 0, locked: false },
      { savedPlaceId: 'place-1', date: '2026-11-08', position: 1, locked: false },
      { savedPlaceId: 'lodging-1', date: '2026-11-08', position: 2, locked: false },
      { savedPlaceId: 'lodging-1', date: '2026-11-09', position: 0, locked: false },
      { savedPlaceId: 'lodging-1', date: '2026-11-09', position: 1, locked: false },
    ]);
  });
});
