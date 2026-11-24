import { describe, expect, it, vi } from 'vitest';
import { RoutesService } from './routes.service';
import { ItineraryBoundaryType } from '../../itineraries/application/dto/itinerary.dto';

vi.mock('../../../common/http/json-logger', () => ({ writeStructuredLog: vi.fn() }));

function setup() {
  const trips = { findOneBy: vi.fn().mockResolvedValue({
    startPoint: { googlePlaceId: 'airport' }, endPoint: { googlePlaceId: 'end-airport' },
    latestAiPlanRequest: { transportModes: ['public_transit', 'walking'] },
  }) };
  const places = { findBy: vi.fn().mockResolvedValue([{ id: 'hotel', googlePlaceId: 'google-hotel' }, { id: 'visit', googlePlaceId: 'google-visit' }]) };
  const transit = vi.fn().mockResolvedValue({
    durationMinutes: 35, distanceMeters: 8000, travelMode: 'public_transit', isFallback: false,
  });
  const service = new RoutesService(trips as never, places as never, { transit }, { getCurrentUserId: () => 'user' });
  return { service, trips, places, transit };
}
describe('route legs after itinerary edits', () => {
  it('resolves airport to saved lodging from the owned trip without accepting caller Google IDs', async () => {
    const { service, transit, trips } = setup();
    const result = await service.transit('trip', { originBoundaryType: ItineraryBoundaryType.StartPoint, destinationSavedPlaceId: 'hotel', departureTime: '2026-12-01T11:00:00Z' });
    expect(result).toMatchObject({ status: 'available', durationMinutes: 35 });
    expect(trips.findOneBy).toHaveBeenCalledWith({ id: 'trip', ownerId: 'user', active: true });
    expect(transit).toHaveBeenCalledWith({
      originGooglePlaceId: 'airport', destinationGooglePlaceId: 'google-hotel',
      departureTime: '2026-12-01T11:00:00Z', fallbackTravelModes: ['walking'],
    });
  });
  it('supports final visit to end boundary and directional saved-place queries', async () => {
    const { service, transit } = setup();
    await service.transit('trip', { originSavedPlaceId: 'visit', destinationBoundaryType: ItineraryBoundaryType.EndPoint });
    expect(transit).toHaveBeenLastCalledWith({ originGooglePlaceId: 'google-visit', destinationGooglePlaceId: 'end-airport', departureTime: undefined, fallbackTravelModes: ['walking'] });
    await service.transit('trip', { originSavedPlaceId: 'hotel', destinationSavedPlaceId: 'visit' });
    expect(transit).toHaveBeenLastCalledWith({ originGooglePlaceId: 'google-hotel', destinationGooglePlaceId: 'google-visit', departureTime: undefined, fallbackTravelModes: ['walking'] });
  });
  it('rejects missing/ambiguous endpoints and places outside the trip', async () => {
    const { service } = setup();
    await expect(service.transit('trip', { destinationSavedPlaceId: 'hotel' })).rejects.toThrow('Specify exactly one');
    await expect(service.transit('trip', { originSavedPlaceId: 'hotel', originBoundaryType: ItineraryBoundaryType.StartPoint, destinationSavedPlaceId: 'visit' })).rejects.toThrow('Specify exactly one');
    await expect(service.transit('trip', { originSavedPlaceId: 'other-trip-place', destinationSavedPlaceId: 'hotel' })).rejects.toThrow('Saved place not found');
  });
  it('returns unavailable instead of fabricated times when a route lookup fails', async () => {
    const { service, transit } = setup();
    transit.mockRejectedValue(new Error('network failed'));
    expect(await service.transit('trip', { originSavedPlaceId: 'hotel', destinationSavedPlaceId: 'visit' })).toMatchObject({ status: 'unavailable', durationMinutes: null });
  });
  it('uses the trip transport preferences for truthful route fallbacks', async () => {
    const { service, transit, trips } = setup();
    trips.findOneBy.mockResolvedValue({
      startPoint: { googlePlaceId: 'airport' }, endPoint: { googlePlaceId: 'end-airport' },
      latestAiPlanRequest: { transportModes: ['public_transit', 'car'] },
    });
    transit.mockResolvedValue({ durationMinutes: 22, distanceMeters: 7100, travelMode: 'car', isFallback: true });
    expect(await service.transit('trip', { originSavedPlaceId: 'hotel', destinationSavedPlaceId: 'visit' }))
      .toMatchObject({ status: 'available', durationMinutes: 22, travelMode: 'car', isFallback: true });
    expect(transit).toHaveBeenCalledWith(expect.objectContaining({ fallbackTravelModes: ['car', 'walking'] }));
  });
  it('returns zero only when both endpoints resolve to the same real place', async () => {
    const { service, transit } = setup();
    expect(await service.transit('trip', { originSavedPlaceId: 'hotel', destinationSavedPlaceId: 'hotel' })).toMatchObject({ durationMinutes: 0, status: 'available' });
    expect(transit).not.toHaveBeenCalled();
  });
});
