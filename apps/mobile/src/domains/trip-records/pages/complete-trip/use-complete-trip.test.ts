import { act, renderHook } from "@testing-library/react-native";
import * as MediaLibrary from "expo-media-library";

import { File } from "expo-file-system";
import { useCompleteTrip } from "./use-complete-trip";

jest.mock("expo-media-library", () => ({
  Asset: { create: jest.fn() },
  requestPermissionsAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: Object.assign(jest.fn(), { downloadFileAsync: jest.fn() }),
  Paths: { cache: "file:///cache" },
}));

jest.mock("../../hooks/use-record-resources", () => ({
  useRecordResources: () => ({
    accessToken: "access-token",
    error: undefined,
    itinerary: { items: [] },
    photos: [],
    reload: jest.fn(),
    trip: { id: "trip-1" },
  }),
}));

describe("useCompleteTrip", () => {
  it("does not download or modify a photo when media permission is denied", async () => {
    jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue({ granted: false } as never);
    const { result } = await renderHook(() => useCompleteTrip("trip-1"));

    await act(async () => {
      await result.current.downloadOriginal({
        id: "photo-1",
        filename: "original.jpg",
        originalUrl: "https://example.com/original.jpg",
      } as never);
    });

    expect(File.downloadFileAsync).not.toHaveBeenCalled();
    expect(MediaLibrary.Asset.create).not.toHaveBeenCalled();
    expect(result.current.error).toBe("사진 저장 권한이 필요해요. 기기 설정에서 권한을 허용해 주세요.");
  });
});
