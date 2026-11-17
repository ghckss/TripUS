import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PlaceSearchPort } from '../../places/domain/place-search.port';
import { TripsService } from './trips.service';
import { TripCoverService } from './trip-cover.service';

function setup(city: { googlePlaceId: string | null; name: string } | null = { googlePlaceId: 'paris', name: '파리' }) {
  const get = vi.fn().mockResolvedValue({ destination: '프랑스', regions: city ? [city] : [] });
  const search = vi.fn().mockResolvedValue([{ googlePlaceId: 'resolved-paris', primaryType: 'locality' }]);
  const getPhoto = vi.fn().mockResolvedValue({ imageUrl: 'https://photo', googleMapsUri: 'https://maps', authorNames: ['Author'] });
  const service = new TripCoverService({ get } as unknown as TripsService, { search, getPhoto } as unknown as PlaceSearchPort);
  return { service, get, search, getPhoto };
}

describe('TripCoverService', () => {
  it('uses the first city and requests a cover-sized photo', async () => {
    const { service, getPhoto, search } = setup();
    expect(await service.get('trip')).toMatchObject({ imageUrl: 'https://photo', authorNames: ['Author'] });
    expect(getPhoto).toHaveBeenCalledWith('paris', { maxWidthPx: 1000, maxHeightPx: 600 });
    expect(search).not.toHaveBeenCalled();
  });

  it('resolves a catalog city to a Google locality before fetching its photo', async () => {
    const { service, search, getPhoto } = setup({ googlePlaceId: null, name: '파리' });
    await service.get('trip');
    expect(search).toHaveBeenCalledWith('파리', '프랑스');
    expect(getPhoto).toHaveBeenCalledWith('resolved-paris', expect.any(Object));
  });

  it('does not request Google data for inaccessible trips', async () => {
    const { service, get, getPhoto } = setup();
    get.mockRejectedValue(new NotFoundException());
    await expect(service.get('other')).rejects.toBeInstanceOf(NotFoundException);
    expect(getPhoto).not.toHaveBeenCalled();
  });

  it('returns an empty cover when photos are unavailable', async () => {
    const { service, getPhoto } = setup();
    getPhoto.mockRejectedValue(new Error('Google unavailable'));
    expect(await service.get('trip')).toEqual({ imageUrl: null, googleMapsUri: null, authorNames: [] });
  });

  it('supports trips without a city without inventing a cover location', async () => {
    const { service, search, getPhoto } = setup(null);
    expect(await service.get('trip')).toMatchObject({ imageUrl: null });
    expect(search).not.toHaveBeenCalled();
    expect(getPhoto).not.toHaveBeenCalled();
  });
});
