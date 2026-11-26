import { tripUsApi } from "@/shared/api/trip-us-api";
import { cacheKeys, writeCache } from "@/shared/offline/cache";
import { queryClient, resourceKey, setResource } from "@/shared/query/query-client";
import { completeTrip, listCompletedTrips } from "@/domains/trip-records/api/trip-records.api";
import { getItinerary } from "@/domains/itineraries/api/itineraries.api";
import { listPlaces, listTravelPlaces, savePlace, updatePlace } from "@/domains/places/api/places.api";
import { getPrimaryLodging } from "@/domains/places/api/lodgings.api";
import { getTrip, listTrips, updateTrip, type Trip } from "./trips.api";

jest.mock("@/shared/api/trip-us-api", () => ({ apiErrorMessage: String, tripUsApi: { GET: jest.fn(), POST: jest.fn(), PATCH: jest.fn() } }));
jest.mock("@/shared/offline/cache", () => ({
  cacheKeys: { trips: "trips:list", completedTrips: "trips:completed", trip: (id: string) => `trips:${id}`, places: (id: string) => `trips:${id}:places`, itinerary: (id: string) => `trips:${id}:itinerary` },
  cachedRequest: (_key: string, load: () => Promise<unknown>) => load(), writeCache: jest.fn(), readCache: jest.fn(), deleteCache: jest.fn(),
}));
jest.mock("@/shared/telemetry/telemetry", () => ({ trackEvent: jest.fn() }));
const trip = { id: "one", title: "Original", active: true, archivedAt: null } as Trip;
beforeEach(() => jest.clearAllMocks());

it("uses the PATCH response in both list and detail without another GET", async () => {
  setResource(cacheKeys.trips, [trip]); setResource(cacheKeys.trip(trip.id), trip);
  const updated = { ...trip, title: "Edited" };
  (tripUsApi.PATCH as jest.Mock).mockResolvedValue({ data: updated });
  await updateTrip(trip.id, { title: "Edited" });
  expect(await getTrip(trip.id)).toEqual(updated);
  expect(await listTrips()).toEqual([updated]);
  expect(tripUsApi.GET).not.toHaveBeenCalled();
});

it("moves archived trips to completed and shares the completion itinerary", async () => {
  setResource(cacheKeys.trips, [trip]); setResource(cacheKeys.completedTrips, []);
  const archived = { ...trip, archivedAt: "2026-11-17T00:00:00.000Z" };
  const itinerary = { items: [], unplaced: [], activities: [] };
  (tripUsApi.POST as jest.Mock).mockResolvedValue({ data: { trip: archived, itinerary } });
  await completeTrip(trip.id, []);
  expect(await listTrips()).toEqual([]);
  expect(await listCompletedTrips()).toEqual([archived]);
  expect(await getTrip(trip.id)).toEqual(archived);
  expect(await getItinerary(trip.id)).toEqual(itinerary);
  expect(tripUsApi.GET).not.toHaveBeenCalled();
  expect(writeCache).toHaveBeenCalledWith(cacheKeys.completedTrips, [archived]);
});

it("shares a single places request across library, lodging and itinerary callers", async () => {
  const hotel = { id: "hotel", isPrimaryLodging: true, tag: "lodging" };
  const visit = { id: "visit", isPrimaryLodging: false, tag: "attraction" };
  (tripUsApi.GET as jest.Mock).mockResolvedValue({ data: [hotel, visit] });
  const [places, travel, lodging] = await Promise.all([listPlaces(trip.id), listTravelPlaces(trip.id), getPrimaryLodging(trip.id)]);
  expect(places).toEqual([hotel, visit]); expect(travel).toEqual([visit]); expect(lodging).toEqual(hotel);
  expect(tripUsApi.GET).toHaveBeenCalledTimes(1);
  const added = { ...visit, id: "new" };
  (tripUsApi.POST as jest.Mock).mockResolvedValue({ data: { status: "created", place: added } });
  await savePlace(trip.id, { name: "New", tag: "attraction", preference: "want_to_visit", isPrimaryLodging: false });
  expect(await listTravelPlaces(trip.id)).toEqual([added, visit]);
  expect(queryClient.getQueryData(resourceKey(cacheKeys.places(trip.id)))).toEqual([added, hotel, visit]);
  expect(tripUsApi.GET).toHaveBeenCalledTimes(1);
});

it("keeps existing display fields when a tag PATCH response clears unrelated fields", async () => {
  const place = {
    id: "place-to-tag", tripId: trip.id, googlePlaceId: null, name: "신주쿠 중앙공원",
    address: null, latitude: null, longitude: null, tag: "attraction",
    preference: "want_to_visit", note: "잔디광장 쪽으로 가기", isPrimaryLodging: false,
  } as const;
  setResource(cacheKeys.places(trip.id), [place]);
  (tripUsApi.PATCH as jest.Mock).mockResolvedValue({ data: {
    id: place.id, tag: "other", name: "", note: null, address: null,
  } });

  const updated = await updatePlace(trip.id, place.id, { tag: "other" });

  expect(updated).toMatchObject({ id: place.id, name: place.name, note: place.note, tag: "other" });
  expect(queryClient.getQueryData(resourceKey(cacheKeys.places(trip.id)))).toEqual([
    expect.objectContaining({ id: place.id, name: place.name, note: place.note, tag: "other" }),
  ]);
  expect(writeCache).toHaveBeenCalledWith(cacheKeys.places(trip.id), [
    expect.objectContaining({ id: place.id, name: place.name, note: place.note, tag: "other" }),
  ]);
});
