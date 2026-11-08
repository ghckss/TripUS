import {
  deletePlace,
  listPlaces,
  savePlace,
  updatePlace,
  type SavedPlace,
} from "./places.api";

export type LodgingDraft = {
  name: string;
  address: string;
};

export async function getPrimaryLodging(tripId: string): Promise<SavedPlace | undefined> {
  const lodgings = (await listPlaces(tripId)).filter((place) => place.tag === "lodging");
  return lodgings.at(-1);
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
    return updatePlace(tripId, existing.id, { name, address, tag: "lodging" });
  }

  const result = await savePlace(tripId, {
    name,
    address: address || undefined,
    tag: "lodging",
    preference: "want_to_visit",
  });
  return result.place;
}
