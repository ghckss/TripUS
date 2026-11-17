import { useState } from "react";
import { useRecordResources } from "../../hooks/use-record-resources";



import { apiErrorMessage } from "@/shared/api/trip-us-api";
import { completeTrip, type CompleteTripItem } from "../../api/trip-records.api";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { confirmPhoto, createPhotoUpload, uploadPhotoBytes } from "../../api/photos.api";

type UploadablePhoto = {
  uri: string;
  mimeType: string;
  byteSize: number;
  filename: string;
};

function isHeicPhoto(asset: ImagePicker.ImagePickerAsset): boolean {
  const mimeType = asset.mimeType?.toLowerCase();
  return mimeType === "image/heic" || mimeType === "image/heif" || /\.(heic|heif)$/i.test(asset.uri);
}

async function preparePhoto(asset: ImagePicker.ImagePickerAsset): Promise<UploadablePhoto> {
  if (!isHeicPhoto(asset)) {
    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      byteSize: asset.fileSize ?? 1,
      filename: asset.fileName ?? `tripus-${Date.now()}.jpg`,
    };
  }

  const converted = await manipulateAsync(asset.uri, [], { compress: 0.9, format: SaveFormat.JPEG });
  const convertedBlob = await (await fetch(converted.uri)).blob();
  const originalName = asset.fileName?.replace(/\.(heic|heif)$/i, "") ?? `tripus-${Date.now()}`;
  return {
    uri: converted.uri,
    mimeType: "image/jpeg",
    byteSize: convertedBlob.size,
    filename: `${originalName}.jpg`,
  };
}

export function useCompleteTrip(tripId: string) {
  const resources = useRecordResources(tripId);
  const { trip, itinerary, photos, reload, accessToken } = resources;
  const [error, setError] = useState<string>();
  const [failedPhotoItemId, setFailedPhotoItemId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string>();
  const complete = async (items: CompleteTripItem[]) => {
    setSaving(true); setError(undefined);
    try { await completeTrip(tripId, items); return true; }
    catch (caught) { setError(apiErrorMessage(caught)); return false; }
    finally { setSaving(false); }
  };

  const addPhoto = async (itineraryItemId: string) => {
    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: false,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (!asset) return;
    setUploadingItemId(itineraryItemId); setError(undefined); setFailedPhotoItemId(undefined);
    try {
      const photo = await preparePhoto(asset);
      const target = await createPhotoUpload(tripId, {
        itineraryItemId,
        mimeType: photo.mimeType,
        byteSize: photo.byteSize,
        filename: photo.filename,
      });
      await uploadPhotoBytes(target, photo.uri);
      await confirmPhoto(tripId, target.photoId);
    } catch (caught) { setFailedPhotoItemId(itineraryItemId); setError(apiErrorMessage(caught)); }
    finally { setUploadingItemId(undefined); }
  };

  const retry = failedPhotoItemId ? () => addPhoto(failedPhotoItemId) : reload;

  return { accessToken, addPhoto, complete, error: error ?? resources.error, itinerary, photos, retry, saving, trip, uploadingItemId };
}
