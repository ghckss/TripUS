import {
  deletePlace,
  listPlaces,
  savePlace,
  updatePlace,
  type SavedPlace,
} from "./places.api";

export type LodgingDraft = {
  googlePlaceId?: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
};

export async function getPrimaryLodging(tripId: string): Promise<SavedPlace | undefined> {
  return (await listPlaces(tripId)).find((place) => place.isPrimaryLodging || (place.isPrimaryLodging == null && place.tag === "lodging"));
}

export async function savePrimaryLodging(
  tripId: string,
  draft: LodgingDraft,
): Promise<SavedPlace | undefined> {
  const existing = await getPrimaryLodging(tripId);
  const name = draft.name.trim();
  const address = draft.address.trim();

  if (!name) {
    if (existing) await deletePlace(tripId, existing.id);
    return undefined;
  }

  if (existing) {
    return updatePlace(tripId, existing.id, {
      ...(draft.googlePlaceId ? { googlePlaceId: draft.googlePlaceId } : {}),
      name,
      address,
      ...(draft.latitude != null && draft.longitude != null ? { latitude: draft.latitude, longitude: draft.longitude } : {}),
      tag: "lodging",
      isPrimaryLodging: true,
    });
  }

  const result = await savePlace(tripId, {
    ...(draft.googlePlaceId ? { googlePlaceId: draft.googlePlaceId } : {}),
    name,
    address: address || undefined,
    ...(draft.latitude != null && draft.longitude != null ? { latitude: draft.latitude, longitude: draft.longitude } : {}),
    tag: "lodging",
    preference: "want_to_visit",
    isPrimaryLodging: true,
  });
  if (result.place.isPrimaryLodging) return result.place;
  return updatePlace(tripId, result.place.id, { tag: "lodging", isPrimaryLodging: true });
}
