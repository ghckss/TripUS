import { defineQuery, getAccountScope, setResource } from "@/shared/query/query-client";
import type { components } from "@tripus/api-client";

import { apiErrorMessage, authenticatedFetch, tripUsApi, tripUsApiBaseUrl } from "@/shared/api/trip-us-api";
import { cachedRequest, cacheKeys, writeCache } from "@/shared/offline/cache";

export type TripPhoto = components["schemas"]["PhotoResponseDto"];
type UploadTarget = components["schemas"]["PhotoUploadTargetDto"];

export function tripPhotoImageSource(photo: TripPhoto, uri: string, accessToken?: string) {
  const variant = uri === photo.thumbnailUrl ? "thumbnail" : uri === photo.optimizedUrl ? "optimized" : "original";
  return uri.startsWith(tripUsApiBaseUrl) && accessToken
    ? { uri, headers: { Authorization: `Bearer ${accessToken}` }, cacheKey: `trip-photo:${photo.id}:${variant}` }
    : { uri, cacheKey: `trip-photo:${photo.id}:${variant}` };
}

export async function createPhotoUpload(
  tripId: string,
  input: { itineraryItemId?: string; replacesPhotoId?: string; mimeType: string; byteSize: number; filename: string },
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

export async function confirmPhoto(tripId: string, photoId: string, replacesPhotoId?: string): Promise<TripPhoto> {
  const account = getAccountScope();
  const { data, error } = await tripUsApi.POST("/v1/trips/{tripId}/photos/{photoId}/confirm", {
    params: { path: { tripId, photoId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  if (account !== getAccountScope()) throw new Error("Session changed during request");
  const photos = setResource<TripPhoto[]>(cacheKeys.photos(tripId), (current) => current
    ? [...current.filter((photo) => photo.id !== data.id && photo.id !== replacesPhotoId), data]
    : undefined);
  if (photos) await writeCache(cacheKeys.photos(tripId), photos);
  return data;
}

export async function deletePhoto(tripId: string, photoId: string): Promise<void> {
  const { error } = await tripUsApi.DELETE("/v1/trips/{tripId}/photos/{photoId}", {
    params: { path: { tripId, photoId } },
  });
  if (error) throw new Error(apiErrorMessage(error));
  const photos = setResource<TripPhoto[]>(cacheKeys.photos(tripId), (current) => current?.filter((photo) => photo.id !== photoId));
  if (photos) await writeCache(cacheKeys.photos(tripId), photos);
}

export const listPhotos = defineQuery((tripId: string) => ({
  key: cacheKeys.photos(tripId), staleTime: 60000,
  request: async (): Promise<TripPhoto[]> => {
    return cachedRequest(cacheKeys.photos(tripId), async () => {
      const { data, error } = await tripUsApi.GET("/v1/trips/{tripId}/photos", { params: { path: { tripId } } });
      if (error) throw new Error(apiErrorMessage(error));
      return data.filter((photo) => photo.status === "ready");
    });
  },
}));
