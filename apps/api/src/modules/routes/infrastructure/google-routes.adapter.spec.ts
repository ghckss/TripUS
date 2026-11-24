import { afterEach, describe, expect, it, vi } from 'vitest';

import { GoogleRoutesAdapter, representativeDepartureTime } from './google-routes.adapter';

afterEach(() => vi.unstubAllGlobals());

describe('representativeDepartureTime', () => {
  it('keeps a future departure unchanged', () => {
    expect(representativeDepartureTime('2026-12-01T11:00:00.000Z', new Date('2026-11-24T00:00:00.000Z')))
      .toBe('2026-12-01T11:00:00.000Z');
  });

  it('moves a past departure to the next matching weekday and time', () => {
    expect(representativeDepartureTime('2026-11-01T02:00:00.000Z', new Date('2026-11-24T00:00:00.000Z')))
      .toBe('2026-11-29T02:00:00.000Z');
  });

  it('omits a departure when none was supplied', () => {
    expect(representativeDepartureTime()).toBeUndefined();
  });
});

describe('GoogleRoutesAdapter route coverage fallback', () => {
  it('returns a labelled walking duration when transit has no route', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ routes: [{ duration: '1621s', distanceMeters: 2100 }] }) });
    vi.stubGlobal('fetch', fetch);
    const adapter = new GoogleRoutesAdapter({ getOrThrow: () => 'key' } as never);

    await expect(adapter.transit({
      originGooglePlaceId: 'origin', destinationGooglePlaceId: 'destination',
      departureTime: '2026-12-01T11:00:00.000Z', fallbackTravelModes: ['walking'],
    })).resolves.toEqual({ durationMinutes: 28, distanceMeters: 2100, travelMode: 'walking', isFallback: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    const transitRequest = JSON.parse((fetch.mock.calls[0]?.[1] as RequestInit).body as string) as Record<string, unknown>;
    const walkingRequest = JSON.parse((fetch.mock.calls[1]?.[1] as RequestInit).body as string) as Record<string, unknown>;
    expect(transitRequest).toMatchObject({ travelMode: 'TRANSIT', departureTime: '2026-12-01T11:00:00.000Z' });
    expect(walkingRequest).toMatchObject({ travelMode: 'WALK' });
    expect(walkingRequest).not.toHaveProperty('departureTime');
  });

  it('rejects a walking fallback that exceeds the traveler limit', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ routes: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ routes: [{ duration: '4320s', distanceMeters: 5700 }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const adapter = new GoogleRoutesAdapter({ getOrThrow: () => 'key' } as never);
    await expect(adapter.transit({
      originGooglePlaceId: 'a', destinationGooglePlaceId: 'b',
      fallbackTravelModes: ['walking'], maxFallbackWalkingMinutes: 10,
    })).resolves.toBeNull();
  });
});
