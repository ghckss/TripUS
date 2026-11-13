import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getItinerary, type Itinerary } from "@/domains/itineraries";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { completeTrip, type CompleteTripItem } from "../../api/trip-records.api";
import * as ImagePicker from "expo-image-picker";
import { confirmPhoto, createPhotoUpload, listPhotos, uploadPhotoBytes, type TripPhoto } from "../../api/photos.api";

export function useCompleteTrip(tripId: string) {
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [uploadingItemId, setUploadingItemId] = useState<string>();
  const reload = useCallback(async () => {
    setError(undefined);
    try {
      const nextItinerary = await getItinerary(tripId);
      setItinerary(nextItinerary);
      setPhotos(await listPhotos(tripId).catch(() => []));
    } catch (caught) { setError(apiErrorMessage(caught)); }
  }, [tripId]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const complete = async (items: CompleteTripItem[]) => {
    setSaving(true); setError(undefined);
    try { await completeTrip(tripId, items); return true; }
    catch (caught) { setError(apiErrorMessage(caught)); return false; }
    finally { setSaving(false); }
  };

  const addPhoto = async (itineraryItemId: string) => {
    const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, allowsMultipleSelection: false });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (!asset) return;
    setUploadingItemId(itineraryItemId); setError(undefined);
    try {
      const target = await createPhotoUpload(tripId, {
        itineraryItemId,
        mimeType: asset.mimeType ?? "image/jpeg",
        byteSize: asset.fileSize ?? 1,
        filename: asset.fileName ?? `tripus-${Date.now()}.jpg`,
      });
      await uploadPhotoBytes(target, asset.uri);
      const photo = await confirmPhoto(tripId, target.photoId);
      setPhotos((current) => [...current, photo]);
    } catch (caught) { setError(apiErrorMessage(caught)); }
    finally { setUploadingItemId(undefined); }
  };

  return { addPhoto, complete, error, itinerary, photos, reload, saving, uploadingItemId };
}
