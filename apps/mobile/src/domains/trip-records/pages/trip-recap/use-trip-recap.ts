import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { getItinerary, type Itinerary } from "@/domains/itineraries";
import { getTrip, type Trip } from "@/domains/trips";
import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { getSession } from "@/shared/auth/session";
import { confirmPhoto, createPhotoUpload, listPhotos, uploadPhotoBytes, type TripPhoto } from "../../api/photos.api";

export function useTripRecap(tripId: string) {
  const [trip, setTrip] = useState<Trip>();
  const [itinerary, setItinerary] = useState<Itinerary>();
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [accessToken, setAccessToken] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextTrip, nextItinerary, nextPhotos, session] = await Promise.all([
        getTrip(tripId), getItinerary(tripId), listPhotos(tripId), getSession(),
      ]);
      setTrip(nextTrip);
      setItinerary(nextItinerary);
      setPhotos(nextPhotos);
      setAccessToken(session?.accessToken);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const addPhotos = async () => {
    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 12,
    });
    if (selection.canceled || selection.assets.length === 0) return;
    setUploading(true);
    setError(undefined);
    try {
      const uploaded: TripPhoto[] = [];
      for (const asset of selection.assets) {
        const target = await createPhotoUpload(tripId, {
          mimeType: asset.mimeType ?? "image/jpeg",
          byteSize: asset.fileSize ?? 1,
          filename: asset.fileName ?? `tripus-${Date.now()}.jpg`,
        });
        await uploadPhotoBytes(target, asset.uri);
        uploaded.push(await confirmPhoto(tripId, target.photoId));
      }
      setPhotos((current) => [...current, ...uploaded]);
    } catch (caught) {
      setError(apiErrorMessage(caught));
    } finally {
      setUploading(false);
    }
  };

  return { accessToken, addPhotos, error, itinerary, loading, photos, reload, trip, uploading };
}
