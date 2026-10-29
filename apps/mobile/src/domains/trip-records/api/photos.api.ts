import type { components } from "@tripus/api-client";

import { apiErrorMessage, authenticatedFetch, tripUsApi, tripUsApiBaseUrl } from "@/shared/api/trip-us-api";

export type TripPhoto = components["schemas"]["PhotoResponseDto"];
type UploadTarget = components["schemas"]["PhotoUploadTargetDto"];

export async function createPhotoUpload(
  tripId: string,
  input: { itineraryItemId: string; mimeType: string; byteSize: number; filename: string },
): Promise<UploadTarget> {
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/photos", { params: { path: { tripId } }, body: input });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function uploadPhotoBytes(target: UploadTarget, uri: string): Promise<void> {
  const body = await (await fetch(uri)).blob();
  const request = target.uploadUrl.startsWith(tripUsApiBaseUrl) ? authenticatedFetch : fetch;
  const response = await request(target.uploadUrl, { method: target.method, headers: target.headers, body });
  if (!response.ok) throw new Error(`사진 업로드에 실패했어요. (${response.status})`);
}

export async function confirmPhoto(tripId: string, photoId: string): Promise<TripPhoto> {
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/photos/{photoId}/confirm", {
    params: { path: { tripId, photoId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}

export async function listPhotos(tripId: string): Promise<TripPhoto[]> {
  const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/photos", { params: { path: { tripId } } });
  if (error) throw new Error(apiErrorMessage(error));
  return data;
}
