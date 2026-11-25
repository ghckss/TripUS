import { useState } from "react";
import { File, Paths } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";

import { apiErrorMessage, tripUsApiBaseUrl } from "@/shared/api/trip-us-api";
import { confirmPhoto, createPhotoUpload, deletePhoto, type TripPhoto, uploadPhotoBytes } from "../../api/photos.api";
import { completeTrip, type CompleteTripItem } from "../../api/trip-records.api";
import { useRecordResources } from "../../hooks/use-record-resources";

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
  const [managingPhotoId, setManagingPhotoId] = useState<string>();
  const [message, setMessage] = useState<string>();
  const complete = async (items: CompleteTripItem[]) => {
    setSaving(true); setError(undefined);
    try { await completeTrip(tripId, items); return true; }
    catch (caught) { setError(apiErrorMessage(caught)); return false; }
    finally { setSaving(false); }
  };

  const addPhoto = async (itineraryItemId: string, replacesPhotoId?: string) => {
    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: false,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (!asset) return;
    setUploadingItemId(itineraryItemId); setError(undefined); setMessage(undefined); setFailedPhotoItemId(undefined);
    try {
      const photo = await preparePhoto(asset);
      const target = await createPhotoUpload(tripId, {
        itineraryItemId,
        replacesPhotoId,
        mimeType: photo.mimeType,
        byteSize: photo.byteSize,
        filename: photo.filename,
      });
      await uploadPhotoBytes(target, photo.uri);
      await confirmPhoto(tripId, target.photoId, replacesPhotoId);
    } catch (caught) { setFailedPhotoItemId(itineraryItemId); setError(apiErrorMessage(caught)); }
    finally { setUploadingItemId(undefined); }
  };

  const removePhoto = async (photoId: string) => {
    setManagingPhotoId(photoId); setError(undefined); setMessage(undefined);
    try {
      await deletePhoto(tripId, photoId);
      setMessage("사진을 삭제했어요.");
    } catch (caught) { setError(apiErrorMessage(caught)); }
    finally { setManagingPhotoId(undefined); }
  };

  const downloadOriginal = async (photo: TripPhoto) => {
    if (!photo.originalUrl) { setError("원본 사진을 불러올 수 없어요."); return; }
    setManagingPhotoId(photo.id); setError(undefined); setMessage(undefined);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) throw new Error("사진 저장 권한이 필요해요. 기기 설정에서 권한을 허용해 주세요.");
      const safeName = photo.filename.replace(/[^a-zA-Z0-9._-]/g, "-") || `${photo.id}.jpg`;
      const target = new File(Paths.cache, `${photo.id}-${safeName}`);
      const headers = photo.originalUrl.startsWith(tripUsApiBaseUrl) && accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined;
      const file = await File.downloadFileAsync(photo.originalUrl, target, { headers, idempotent: true });
      await MediaLibrary.Asset.create(file.uri);
      setMessage("원본 사진을 기기에 저장했어요.");
    } catch (caught) { setError(apiErrorMessage(caught)); }
    finally { setManagingPhotoId(undefined); }
  };

  const retry = failedPhotoItemId ? () => addPhoto(failedPhotoItemId) : reload;

  return { accessToken, addPhoto, complete, downloadOriginal, error: error ?? resources.error, itinerary, managingPhotoId, message, photos, removePhoto, retry, saving, trip, uploadingItemId };
}
