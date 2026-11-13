import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GooglePlaceSearchAdapter } from './google-place-search.adapter';

describe('GooglePlaceSearchAdapter photos', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resolves a short-lived photo URL with its Google Maps source attribution', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ photos: [{
        name: 'places/google-place-1/photos/photo-1',
        googleMapsUri: 'https://maps.google.com/photo-1',
        authorAttributions: [{ displayName: '사진가' }],
      }] }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        photoUri: 'https://lh3.googleusercontent.com/photo-1',
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', request);
    const adapter = new GooglePlaceSearchAdapter({
      getOrThrow: vi.fn().mockReturnValue('server-api-key'),
    } as unknown as ConfigService);

    await expect(adapter.getPhoto('google-place-1')).resolves.toEqual({
      imageUrl: 'https://lh3.googleusercontent.com/photo-1',
      googleMapsUri: 'https://maps.google.com/photo-1',
      authorNames: ['사진가'],
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(String(request.mock.calls[1]?.[0])).toContain('skipHttpRedirect=true');
    expect(String(request.mock.calls[1]?.[0])).toContain('key=server-api-key');
  });

  it('does not expose a photo that has no Google Maps source link', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ photos: [{
      name: 'places/google-place-1/photos/photo-1',
    }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', request);
    const adapter = new GooglePlaceSearchAdapter({
      getOrThrow: vi.fn().mockReturnValue('server-api-key'),
    } as unknown as ConfigService);

    await expect(adapter.getPhoto('google-place-1')).resolves.toBeNull();
    expect(request).toHaveBeenCalledOnce();
  });
});
